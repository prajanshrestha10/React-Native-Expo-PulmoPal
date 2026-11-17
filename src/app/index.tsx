import * as Device from 'expo-device';
import { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import Markdown from 'react-native-markdown-display';
import { colors } from '../theme/colors';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  createdAt: number;
};

export default function HomeScreen() {
  // Chat API
  const generateGroqReply = async (
    userText: string
  ): Promise<string> => {
    const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;

    if (!apiKey) {
      throw new Error('Groq API key is missing.');
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [
            {
              role: 'system',
              content: `You are PulmoPal, an educational support assistant focused on lung health and lung cancer.

              Rules:
              - Provide clear, compassionate, general educational information.
              - Do not diagnose medical conditions.
              - Do not prescribe medication or recommend changing treatment.
              - Encourage consultation with a qualified healthcare professional.
              - If the user reports severe trouble breathing, chest pain, coughing up significant blood, fainting, confusion, or another possible emergency, tell them to contact local emergency services immediately.
              - Avoid requesting identifying medical information.
              - Politely redirect questions unrelated to lung health.
              - Keep responses under 500 words.
              - Prioritize the most important information.
              - Always finish the current sentence and list before ending.
              - If the topic is too broad, provide a concise overview and invite the user to ask a follow-up question.
              
              Formatting requirements:
              - Use short paragraphs and clear headings.
              - Use bullet points or numbered lists when helpful.
              - Avoid tables.
              - Do not use raw HTML.`,
            },
            {
              role: 'user',
              content: userText,
            },
          ],
          temperature: 0.4,
          max_completion_tokens: 400,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const apiMessage =
        data?.error?.message ??
        `Groq request failed with status ${response.status}.`;

      throw new Error(apiMessage);
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error('Groq returned an empty response.');
    }

    return reply;
  };

  // Asking the API for their available models
  const listGroqModels = async (): Promise<void> => {
    const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;

    if (!apiKey) {
      console.warn('Groq API key is missing.');
      return;
    }

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/models',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.warn(
          'Could not list Groq models:',
          data?.error?.message ?? response.status
        );
        return;
      }

      const modelIds = data?.data
        ?.filter(
          (model: { active?: boolean }) =>
            model.active !== false
        )
        .map(
          (model: { id: string }) =>
            model.id
        );

      console.log('Available Groq models:', modelIds);
    } catch (error) {
      console.warn('Failed to list Groq models:', error);
    }
  };

  const suggestedQuestions = [
    'What are common treatment side effects?',
    'How can I manage shortness of breath?',
    'What should I ask my doctor?',
    'How can a caregiver offer support?',
  ];

  const handleSuggestedQuestion = (question: string) => {
    setInputText(question);
  }

  const handleSend = async () => {
    const trimmedText = inputText.trim();

    if (!trimmedText) {
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: trimmedText,
      sender: 'user',
      createdAt: Date.now(),
    };

    // This creates a new array containing all existing messages followed by the new one.
    setMessages((currentMessages) => [
      ...currentMessages,
      newMessage,
    ]);

    setInputText('');
    Keyboard.dismiss(); 

    setIsResponding(true);
    try {
      const replyText = await generateGroqReply(trimmedText);

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        text: replyText,
        sender: 'assistant',
        createdAt: Date.now(),
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantMessage,
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.';

      console.warn(
        'Groq request failed:',
        errorMessage
      );

      const normalizedError = errorMessage.toLowerCase();

      const isTemporaryError =
        normalizedError.includes('high demand') ||
        normalizedError.includes('unavailable') ||
        normalizedError.includes('temporarily') ||
        normalizedError.includes('quota');

      const assistantErrorMessage: Message = {
        id: `${Date.now()}-error`,
        text: isTemporaryError
          ? 'PulmoPal is temporarily busy because the AI service is experiencing high demand. Please wait a few minutes and try again.'
          : 'Sorry, PulmoPal could not generate a response. Please try again.',
        sender: 'assistant',
        createdAt: Date.now(),
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantErrorMessage,
      ]);
    } finally {
      setIsResponding(false);
    }
  };
  
  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputText('');
    setIsResponding(false);
    Keyboard.dismiss();
  };

  // useStates
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const cannotSend = !inputText.trim() || isResponding;

  // useRefs
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.chatHeader}>
            <ThemedText style={styles.chatHeaderTitle}>
              PulmoPal
            </ThemedText>

            {messages.length > 0 && !isResponding && (
              <Pressable
                onPress={handleNewChat}
                style={({ pressed }) => [
                  styles.newChatButton,
                  pressed && styles.newChatButtonPressed,
                ]}>
                <ThemedText style={styles.newChatButtonText}>
                  New chat
                </ThemedText>
              </Pressable>
            )}
          </View>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }}
          >  
            {messages.length === 0 && (
              <>
                <View style={styles.heroSection}>
                  <ThemedText style={styles.title}>
                    Welcome to PulmoPal
                  </ThemedText>

                  <ThemedText style={styles.subtitle}>
                    Supportive guidance for your lung health journey
                  </ThemedText>
                </View>

                <ThemedView style={styles.welcomeCard}>
                  <ThemedText style={styles.welcomeTitle}>
                    How can I support you today?
                  </ThemedText>

                  <ThemedText style={styles.welcomeText}>
                    Ask about lung cancer, treatments, side effects, or everyday support.
                  </ThemedText>
                </ThemedView>

                <View style={styles.suggestionsSection}>
                  <ThemedText style={styles.suggestionsTitle}>
                    You can ask:
                  </ThemedText>
                </View>

                {/* suggestions section */}
                <View style={styles.chipsContainer}>
                  {suggestedQuestions.map((question) => (
                    <Pressable
                      key={question}
                      onPress={() => handleSuggestedQuestion(question)}
                      style={({ pressed }) => [
                        styles.chip,
                        pressed && styles.chipPressed,
                      ]}>
                      <ThemedText style={styles.chipText}>
                        {question}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {messages.length > 0 && (
              <View style={styles.messagesContainer}>
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      message.sender === 'user'
                        ? styles.userMessageRow
                        : styles.assistantMessageRow,
                    ]}>
                    <View
                      style={[
                        styles.messageBubble,
                        message.sender === 'user'
                          ? styles.userMessageBubble
                          : styles.assistantMessageBubble,
                      ]}>
                      {message.sender === 'assistant' ? (
                        <Markdown style={markdownStyles}>
                          {message.text}
                        </Markdown>
                      ) : (
                        <ThemedText
                          style={[
                            styles.messageText,
                            styles.userMessageText,
                          ]}>
                          {message.text}
                        </ThemedText>
                      )}
                      <ThemedText
                        style={[
                          styles.messageTime,
                          message.sender === 'user' && styles.userMessageTime,
                        ]}>
                        {formatMessageTime(message.createdAt)}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {isResponding && (
              <View style={[styles.messageRow, styles.assistantMessageRow]}>
                <View
                  style={[
                    styles.messageBubble,
                    styles.assistantMessageBubble,
                  ]}>
                  <ThemedText style={styles.respondingText}>
                    PulmoPal is responding…
                  </ThemedText>
                </View>
              </View>
            )}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask PulmoPal a question..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <Pressable
              onPress={handleSend}
              disabled={cannotSend}
              style={({ pressed }) => [
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
                pressed && inputText.trim() && styles.sendButtonPressed,
              ]}>
              <ThemedText style={styles.sendButtonText}>
                Send
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  safeArea: {
    flex: 1
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 8,
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  welcomeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
  },
  welcomeTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  welcomeText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  suggestionsSection: {
    marginTop: 24,
  },
  suggestionsTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chipsContainer: {
    gap: 10,
  },
  chip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chipText: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 21,
  },
  chipPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 8,
    marginTop: 24,
    marginLeft: 5,
    marginRight: 5,
    gap: 8
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonPressed: {
    opacity: 0.75,
  },
  sendButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  messagesContainer: {
    marginTop: 20,
    gap: 12,
  },

  messageRow: {
    width: '100%',
    flexDirection: 'row',
  },

  userMessageRow: {
    justifyContent: 'flex-end',
  },

  assistantMessageRow: {
    justifyContent: 'flex-start',
  },

  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  userMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },

  assistantMessageBubble: {
    backgroundColor: colors.primaryLight,
    borderBottomLeftRadius: 6,
  },

  messageText: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },

  userMessageText: {
    color: colors.surface,
  },

  sendButtonDisabled: {
    opacity: 0.45,
  },
  respondingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  messageTime: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  userMessageTime: {
    color: colors.surface,
    opacity: 0.8,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  chatHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },

  newChatButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  newChatButtonPressed: {
    opacity: 0.7,
  },

  newChatButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

const markdownStyles = {
  body: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 0,
    marginBottom: 0,
  },

  paragraph: {
    marginTop: 0,
    marginBottom: 10,
  },

  strong: {
    color: colors.textPrimary,
    fontWeight: '700' as const,
  },

  em: {
    fontStyle: 'italic' as const,
  },

  heading1: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700' as const,
    marginTop: 4,
    marginBottom: 10,
  },

  heading2: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '700' as const,
    marginTop: 4,
    marginBottom: 8,
  },

  heading3: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700' as const,
    marginTop: 4,
    marginBottom: 6,
  },

  bullet_list: {
    marginTop: 2,
    marginBottom: 10,
  },

  ordered_list: {
    marginTop: 2,
    marginBottom: 10,
  },

  list_item: {
    marginBottom: 6,
  },

  bullet_list_icon: {
    color: colors.primary,
  },

  ordered_list_icon: {
    color: colors.primary,
    fontWeight: '700' as const,
  },

  blockquote: {
    backgroundColor: colors.primaryLight,
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },

  code_inline: {
    backgroundColor: colors.primaryLight,
    color: colors.textPrimary,
    borderRadius: 4,
    paddingHorizontal: 5,
  },

  fence: {
    backgroundColor: '#F1EEE8',
    color: colors.textPrimary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },

  table: {
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 8,
  },

  tr: {
    borderBottomWidth: 1,
    borderColor: colors.border,
  },

  th: {
    backgroundColor: colors.primaryLight,
    padding: 7,
  },

  td: {
    padding: 7,
  },

  link: {
    color: colors.primary,
    textDecorationLine: 'underline' as const,
  },
};
