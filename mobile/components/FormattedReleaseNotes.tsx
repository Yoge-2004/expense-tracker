/**
 * @file FormattedReleaseNotes.tsx
 * @description Beautifully rendered, structured release notes and changelog viewer.
 * Parses raw GitHub release Markdown (headings, bullet points, commit hashes,
 * PR references, contributor handles, code snippets, and compare links)
 * into an executive-grade, accessible visual layout.
 */

import React, { memo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from './ThemedText';
import { ThemeColors } from '../constants/theme';
import { softWrapLongWords } from '../services/appUpdate';

export interface FormattedReleaseNotesProps {
  rawNotes: string;
  colors: ThemeColors;
  maxHeight?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface ParsedBlock {
  type: 'heading' | 'bullet' | 'paragraph' | 'changelog-link';
  text: string;
  level?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  url?: string;
}

/**
 * Parses raw Markdown release notes into structured presentation blocks.
 */
export function parseReleaseNotes(notes: string): ParsedBlock[] {
  if (!notes || !notes.trim()) return [];

  const lines = notes.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // 1. Heading check: ## Heading or ### Subheading
    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      const headingText = headingMatch[1].replace(/[*_`]/g, '').trim();
      const lower = headingText.toLowerCase();

      let icon: keyof typeof Ionicons.glyphMap = 'cube-outline';
      if (lower.includes('changed') || lower.includes('new') || lower.includes('feature')) {
        icon = 'sparkles-outline';
      } else if (lower.includes('fix') || lower.includes('bug')) {
        icon = 'shield-checkmark-outline';
      } else if (lower.includes('perf') || lower.includes('speed') || lower.includes('improv')) {
        icon = 'flash-outline';
      } else if (lower.includes('doc') || lower.includes('guide')) {
        icon = 'document-text-outline';
      }

      blocks.push({
        type: 'heading',
        text: headingText,
        level: trimmed.startsWith('###') ? 3 : 2,
        icon,
      });
      continue;
    }

    // 2. Full changelog link: **Full Changelog**: https://... or [Full Changelog](https://...)
    const changelogMatch = trimmed.match(/(?:\*\*|\*|__|_)?(?:full changelog|compare)(?:\*\*|\*|__|_)?\s*[:：]?\s*(https?:\/\/[^\s)]+)/i);
    if (changelogMatch) {
      blocks.push({
        type: 'changelog-link',
        text: 'View Full Commit Changelog',
        url: changelogMatch[1],
      });
      continue;
    }

    // 3. Bullet points: * item or - item or + item
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({
        type: 'bullet',
        text: bulletMatch[1].trim(),
      });
      continue;
    }

    // 4. Fallback: regular paragraph
    blocks.push({
      type: 'paragraph',
      text: trimmed,
    });
  }

  return blocks;
}

/**
 * Renders inline text with highlights for code snippets, #PRs, @mentions, and markdown links.
 */
function InlineFormattedText({ text, colors: c }: { text: string; colors: ThemeColors }) {
  // Replace Markdown links [text](url) with just the text or token
  const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const wrapped = softWrapLongWords(cleaned);

  // Regex splitting by: `code`, #PR, @mention
  const tokenRegex = /(`[^`]+`|#\d+|@[\w.-]+)/g;
  const parts = wrapped.split(tokenRegex);

  return (
    <Text style={[styles.inlineText, { color: c.text }]}>
      {parts.map((part, index) => {
        if (!part) return null;

        // Code snippet: `code`
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          const code = part.slice(1, -1);
          return (
            <Text
              key={index}
              style={[
                styles.codeSpan,
                {
                  backgroundColor: c.inputBg,
                  color: c.accent,
                  borderColor: c.border,
                },
              ]}
            >
              {` ${code} `}
            </Text>
          );
        }

        // PR / Issue link: #123
        if (/^#\d+$/.test(part)) {
          return (
            <Text key={index} style={[styles.prBadge, { color: c.primary }]}>
              {part}
            </Text>
          );
        }

        // Contributor mention: @name
        if (/^@[\w.-]+$/.test(part)) {
          return (
            <Text key={index} style={[styles.mentionBadge, { color: c.primary }]}>
              {part}
            </Text>
          );
        }

        // Bold stripping or regular text
        const plainText = part.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
        return (
          <Text key={index} style={{ color: c.text }}>
            {plainText}
          </Text>
        );
      })}
    </Text>
  );
}

export const FormattedReleaseNotes: React.FC<FormattedReleaseNotesProps> = memo(
  function FormattedReleaseNotes({
    rawNotes,
    colors: c,
    maxHeight = 220,
    compact = false,
    style,
  }) {
    const blocks = parseReleaseNotes(rawNotes);

    if (blocks.length === 0) {
      return (
        <View style={[styles.emptyContainer, { borderColor: c.border }, style]}>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            No release notes provided for this version.
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: c.bg,
            borderColor: c.border,
          },
          style,
        ]}
      >
        <ScrollView
          style={{ maxHeight }}
          contentContainerStyle={[styles.scrollContent, compact && styles.compactScroll]}
          nestedScrollEnabled
          persistentScrollbar
          showsVerticalScrollIndicator
          accessibilityLabel="Changelog and release notes"
        >
          {blocks.map((block, index) => {
            if (block.type === 'heading') {
              return (
                <View
                  key={`heading-${index}`}
                  style={[
                    styles.headingRow,
                    index > 0 && styles.headingSpacing,
                    { borderBottomColor: c.border },
                  ]}
                >
                  <View style={[styles.headingIconWrap, { backgroundColor: c.primary + '18' }]}>
                    <Ionicons name={block.icon || 'cube-outline'} size={14} color={c.primary} />
                  </View>
                  <Text style={[styles.headingText, { color: c.text }]}>
                    {block.text}
                  </Text>
                </View>
              );
            }

            if (block.type === 'bullet') {
              return (
                <View key={`bullet-${index}`} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: c.primary }]} />
                  <View style={styles.bulletBody}>
                    <InlineFormattedText text={block.text} colors={c} />
                  </View>
                </View>
              );
            }

            if (block.type === 'changelog-link') {
              return (
                <TouchableOpacity
                  key={`link-${index}`}
                  activeOpacity={0.75}
                  onPress={() => block.url && Linking.openURL(block.url).catch(() => {})}
                  style={[
                    styles.changelogLinkBtn,
                    {
                      backgroundColor: c.card,
                      borderColor: c.borderAccent || c.border,
                    },
                  ]}
                >
                  <Ionicons name="git-compare-outline" size={15} color={c.primary} />
                  <Text style={[styles.changelogLinkText, { color: c.primary }]}>
                    {block.text}
                  </Text>
                  <Ionicons name="open-outline" size={13} color={c.textMuted} />
                </TouchableOpacity>
              );
            }

            return (
              <View key={`p-${index}`} style={styles.paragraphRow}>
                <InlineFormattedText text={block.text} colors={c} />
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }
);

FormattedReleaseNotes.displayName = 'FormattedReleaseNotes';

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginVertical: 10,
  },
  scrollContent: {
    padding: 14,
    gap: 8,
  },
  compactScroll: {
    padding: 10,
    gap: 6,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  headingSpacing: {
    marginTop: 12,
  },
  headingIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 2,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletBody: {
    flex: 1,
  },
  inlineText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  codeSpan: {
    fontSize: 11.5,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    fontFamily: 'IBMPlexMono_500Medium',
  },
  prBadge: {
    fontWeight: '700',
    fontSize: 12,
  },
  mentionBadge: {
    fontWeight: '600',
    fontSize: 12,
  },
  paragraphRow: {
    paddingVertical: 2,
  },
  changelogLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  changelogLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
  },
});
