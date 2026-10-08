import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { ScrappedCharacter, ScrappedEntry, ScrappedPerson, fetchCharacterDetails } from '@/screens/details/scrapped-details-api';
import { useTheme } from '@/theme/theme-context';

export function CharacterDetailsScreen() {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>();
  const characterId = Number(id);
  const validId = Number.isSafeInteger(characterId) && characterId > 0;
  const [character, setCharacter] = useState<ScrappedCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!validId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchCharacterDetails(characterId);
        if (!active) return;
        setCharacter(data);
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
  }, [characterId, validId]);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title={character?.name ?? title ?? 'Character details'} onMenuPress={openDrawer} />
      {character ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.profile, { backgroundColor: theme.brush.detailsUpperBackground }]}>
            <RemoteImage uri={character.imageUrl} style={styles.portrait} />
            <View style={styles.profileText}>
              <AppText size={theme.fontSize.big} color={theme.brush.text}>
                {character.name}
              </AppText>
              <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>
                MAL character #{character.id}
              </AppText>
              {character.details.map((detail) => (
                <AppText key={detail} size={theme.fontSize.small} color={theme.accentDark}>
                  {detail}
                </AppText>
              ))}
            </View>
          </View>

          {character.biography ? (
            <View style={styles.section}>
              <SectionTitle>Biography</SectionTitle>
              <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.bodyText}>
                {character.biography}
              </AppText>
            </View>
          ) : null}

          {character.spoilers ? (
            <View style={styles.section}>
              <SectionTitle>Spoiler information</SectionTitle>
              <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.bodyText}>
                {character.spoilers}
              </AppText>
            </View>
          ) : null}

          <EntrySection title="Animeography" entries={character.animeography} />
          <EntrySection title="Mangaography" entries={character.mangaography} />
          <View style={styles.section}>
            <SectionTitle>Voice actors</SectionTitle>
            {character.voiceActors.length ? character.voiceActors.map((person) => (
              <PersonRow key={person.id} person={person} />
            )) : (
              <AppText size={theme.fontSize.normal} color={theme.brush.settingsSubtitle}>
                No voice actors were listed.
              </AppText>
            )}
          </View>
        </ScrollView>
      ) : null}
      {failed || !validId ? <EmptyState title="Could not load character details" message={`MAL character #${characterId}`} style={StyleSheet.absoluteFill} /> : null}
      <LoadingOverlay visible={loading && validId} />
    </View>
  );
}

function EntrySection({ title, entries }: { title: string; entries: ScrappedEntry[] }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      {entries.length ? entries.map((entry) => (
        <Ripple
          key={`${entry.kind}-${entry.id}`}
          onPress={() => router.push(`/details?kind=${entry.kind}&id=${entry.id}&title=${encodeURIComponent(entry.title)}`)}
          style={[styles.entry, { backgroundColor: theme.brush.animeItemBackground }]}>
          <RemoteImage uri={entry.imageUrl} style={styles.entryImage} />
          <View style={styles.entryText}>
            <AppText size={theme.fontSize.normal} color={theme.brush.text} numberOfLines={2}>
              {entry.title}
            </AppText>
            {entry.notes ? (
              <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle} numberOfLines={2}>
                {entry.notes}
              </AppText>
            ) : null}
          </View>
        </Ripple>
      )) : (
        <AppText size={theme.fontSize.normal} color={theme.brush.settingsSubtitle}>
          No entries were listed.
        </AppText>
      )}
    </View>
  );
}

function PersonRow({ person }: { person: ScrappedPerson }) {
  const theme = useTheme();
  return (
    <Ripple
      onPress={() => router.push(`/person-details?id=${person.id}&title=${encodeURIComponent(person.name)}`)}
      style={[styles.entry, { backgroundColor: theme.brush.animeItemBackground }]}>
      <RemoteImage uri={person.imageUrl} style={styles.personImage} />
      <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.entryText}>
        {person.name}
      </AppText>
    </Ripple>
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
  section: { paddingHorizontal: 12, paddingBottom: 8 },
  sectionTitle: { marginTop: 14, marginBottom: 8 },
  bodyText: { lineHeight: 21 },
  entry: { flexDirection: 'row', alignItems: 'center', padding: 8, minHeight: 76, marginBottom: 4 },
  entryImage: { width: 54, height: 64 },
  personImage: { width: 54, height: 64 },
  entryText: { flex: 1, paddingHorizontal: 10 },
});
