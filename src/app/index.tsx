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
  const suggestedQuestions = [
    'What are common treatment side effects?',
    'How can I manage shortness of breath?',
    'What should I ask my doctor?',
    'How can a caregiver offer support?',
  ];

  const handleSuggestedQuestion = (question: string) => {
    setInputText(question);
  }

  const handleSend = () => {
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
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        text: 'I can provide general educational information, but I cannot diagnose conditions or replace advice from your healthcare team.',
        sender: 'assistant',
        createdAt: Date.now(),
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantMessage,
      ]);
      setIsResponding(false);
    }, 1000);
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
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
          keyboardVerticalOffset={0}>
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
                      <ThemedText
                        style={[
                          styles.messageText,
                          message.sender === 'user' && styles.userMessageText,
                        ]}>
                        {message.text}
                      </ThemedText>
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

            {/* suggestions section */}
            <View style={styles.suggestionsSection}>
              <ThemedText style={styles.suggestionsTitle}>
                You can ask:
              </ThemedText>

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
            </View>

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
          </ScrollView>
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
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
});
