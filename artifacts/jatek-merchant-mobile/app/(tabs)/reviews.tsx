import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, LoadingState, ScreenFrame, SectionTitle } from '@/components/MerchantUI';
import { useColors } from '@/hooks/useColors';
import { merchantQueryKey } from '@/lib/query-client';
import type { MerchantReview } from '@/lib/types';
import { dateLabel } from '@/lib/types';

export default function MerchantReviewsScreen() {
  const colors = useColors();
  const reviews = useQuery<MerchantReview[]>({
    queryKey: merchantQueryKey('/api/backend/reviews'),
  });
  const stats = useMemo(() => {
    const items = reviews.data ?? [];
    const average = items.length
      ? (items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length).toFixed(1)
      : '—';
    return {
      average,
      comments: items.filter((item) => Boolean(item.comment?.trim())).length,
      latest: items[0] ? dateLabel(items[0].createdAt).split(' à ')[0] : '—',
    };
  }, [reviews.data]);

  return (
    <ScreenFrame
      title="Avis clients"
      eyebrow="VOIX DES CLIENTS"
      subtitle="Les retours des clients de votre boutique."
      onRefresh={() => void reviews.refetch()}
      refreshing={reviews.isRefetching}
    >
      {reviews.isLoading ? (
        <LoadingState />
      ) : reviews.isError ? (
        <LoadingState
          error={reviews.error instanceof Error ? reviews.error.message : undefined}
          onRetry={() => void reviews.refetch()}
        />
      ) : (reviews.data ?? []).length === 0 ? (
        <EmptyState
          title="Pas encore d’avis"
          detail="Les avis publiés apparaîtront ici dès que vos clients partageront leur expérience."
          icon="star"
        />
      ) : (
        <>
          <View style={styles.stats}>
            <Card style={[styles.averageCard, { backgroundColor: colors.sidebar }]}>
              <Text style={[styles.statLabel, { color: '#c6c9d4' }]}>NOTE MOYENNE</Text>
              <View style={styles.ratingLine}>
                <Text style={[styles.average, { color: '#ffffff' }]}>{stats.average}</Text>
                <Feather name="star" size={19} color={colors.accent} />
              </View>
              <Text style={[styles.statFoot, { color: '#c6c9d4' }]}>sur 5</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>AVIS ÉCRITS</Text>
              <Text style={[styles.statNumber, { color: colors.foreground }]}>{stats.comments}</Text>
              <Text style={[styles.statFoot, { color: colors.mutedForeground }]}>avec commentaire</Text>
            </Card>
          </View>
          <Card style={styles.latestCard}>
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={[styles.latestLabel, { color: colors.mutedForeground }]}>Dernier avis</Text>
            <Text style={[styles.latestValue, { color: colors.foreground }]}>{stats.latest}</Text>
          </Card>
          <SectionTitle title={`Avis récents · ${reviews.data?.length ?? 0}`} />
          <View style={styles.reviewList}>
            {(reviews.data ?? []).map((review) => {
              const initials = review.userName
                ?.trim()
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'C';
              return (
                <Card key={review.id} style={styles.reviewCard} >
                  <View style={styles.reviewHeader}>
                    <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.avatarText, { color: colors.secondaryForeground }]}>{initials}</Text>
                    </View>
                    <View style={styles.reviewIdentity}>
                      <Text style={[styles.reviewer, { color: colors.foreground }]} numberOfLines={1}>
                        {review.userName || 'Client'}
                      </Text>
                      <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>
                        {dateLabel(review.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.ratingBadge, { backgroundColor: colors.accent }]}>
                      <Feather name="star" size={12} color={colors.accentForeground} />
                      <Text style={[styles.ratingText, { color: colors.accentForeground }]}>
                        {review.rating}/5
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.comment, { color: colors.foreground }]}>
                    {review.comment?.trim() || 'Aucun commentaire écrit pour cet avis.'}
                  </Text>
                  <View style={[styles.readOnlyNote, { borderColor: colors.border }]}>
                    <Feather name="info" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                      Les avis sont consultables depuis cet espace.
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10 },
  averageCard: { flex: 1, padding: 14, borderColor: 'transparent' },
  statCard: { flex: 1, padding: 14 },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  average: { fontSize: 29, fontWeight: '800' },
  statNumber: { marginTop: 12, fontSize: 27, fontWeight: '800' },
  statFoot: { marginTop: 3, fontSize: 10 },
  latestCard: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 13 },
  latestLabel: { flex: 1, fontSize: 12 },
  latestValue: { fontSize: 12, fontWeight: '800' },
  reviewList: { gap: 11 },
  reviewCard: { padding: 14, gap: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  reviewIdentity: { flex: 1, minWidth: 0 },
  reviewer: { fontSize: 12, fontWeight: '800' },
  reviewDate: { marginTop: 3, fontSize: 10 },
  ratingBadge: { minHeight: 28, borderRadius: 10, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 10, fontWeight: '800' },
  comment: { fontSize: 13, lineHeight: 19 },
  readOnlyNote: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteText: { fontSize: 10 },
});