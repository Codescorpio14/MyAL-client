import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { ScrappedPerson, fetchPersonDetails } from '@/screens/details/scrapped-details-api';
import { useTheme } from '@/theme/theme-context';

export function PersonDetailsScreen() {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>();
  const personId = Number(id);
  const validId = Number.isSafeInteger(personId) && personId > 0;
  const [person, setPerson] = useState<ScrappedPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!validId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchPersonDetails(personId);
        if (!active) return;
        setPerson(data);
        setFailed(!data.name);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [personId, validId]);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title={person?.name ?? title ?? 'Person details'} onMenuPress={openDrawer} />
      {person ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.profile, { backgroundColor: theme.brush.detailsUpperBackground }]}>
            <RemoteImage uri={person.imageUrl} style={styles.portrait} />
            <View style={styles.profileText}>
              <AppText size={theme.fontSize.big} color={theme.brush.text}>
                {person.name}
              </AppText>
              <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>
                MAL person #{person.id}
              </AppText>
            </View>
          </View>

          {person.details.length ? (
            <View style={styles.section}>
              <SectionTitle>Details</SectionTitle>
              {person.details.map((line, index) => (
                <AppText key={`${index}-${line}`} size={theme.fontSize.normal} color={theme.brush.text} style={styles.info}>
                  {line}
                </AppText>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionTitle>Anime &amp; manga credits</SectionTitle>
            {person.credits.length ? person.credits.map((entry) => (
              <Ripple
                key={`${entry.kind}-${entry.id}`}
                onPress={() => router.push(`/details?kind=${entry.kind}&id=${entry.id}&title=${encodeURIComponent(entry.title)}`)}
                style={[styles.credit, { backgroundColor: theme.brush.animeItemBackground }]}>
                <RemoteImage uri={entry.imageUrl} style={styles.creditImage} />
                <View style={styles.creditText}>
                  <AppText size={theme.fontSize.normal} color={theme.brush.text} numberOfLines={2}>
                    {entry.title}
                  </AppText>
                  {entry.notes ? (
                    <AppText size={theme.fontSize.small} color={theme.accentDark} numberOfLines={2}>
                      {entry.notes}
                    </AppText>
                  ) : null}
                </View>
                <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>
                  {entry.kind}
                </AppText>
              </Ripple>
            )) : (
              <AppText size={theme.fontSize.normal} color={theme.brush.settingsSubtitle}>
                No credits were listed.
              </AppText>
            )}
          </View>
        </ScrollView>
      ) : null}
      {failed || !validId ? <EmptyState title="Could not load person details" message={`MAL person #${personId}`} style={StyleSheet.absoluteFill} /> : null}
      <LoadingOverlay visible={loading && validId} />
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <AppText size={theme.fontSize.medium} color={theme.accentColor} style={styles.sectionTitle}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 24 },
  profile: { flexDirection: 'row', minHeight: 150, padding: 12 },
  portrait: { width: 105, height: 145 },
  profileText: { flex: 1, justifyContent: 'center', paddingHorizontal: 14, gap: 8 },
  section: { paddingHorizontal: 12, paddingBottom: 12 },
  sectionTitle: { marginTop: 14, marginBottom: 8 },
  info: { paddingVertical: 4 },
  credit: { flexDirection: 'row', alignItems: 'center', padding: 8, minHeight: 76, marginBottom: 4 },
  creditImage: { width: 54, height: 64 },
  creditText: { flex: 1, paddingHorizontal: 10, gap: 4 },
});
