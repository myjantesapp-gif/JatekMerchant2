import React, { useMemo } from 'react';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useMerchantReviews, type MerchantReview } from '@/lib/merchant-parity-data';
import { dateTime } from '@/lib/format';
import { ErrorState, SkeletonCards, StateView, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';

function initials(name?: string | null) {
  return name?.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'C';
}

function Stars({ rating }: { rating: number | null | undefined }) {
  const c = useColors();
  const value = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  return (
    <View
      accessible
      accessibilityLabel={`Note ${rating ?? 'non renseignée'} sur 5`}
      style={s.stars}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Feather key={index} name="star" size={15} color={index < value ? c.accent : c.border} />
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: MerchantReview }) {
  const c = useColors();
  return (
    <View
      testID={`card-review-${review.id}`}
      style={[ui.card, s.review, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }]}
    >
      <View style={[s.avatar, { backgroundColor: c.secondary }]}>
        <Text style={[s.avatarText, { color: c.secondaryForeground }]}>{initials(review.userName)}</Text>
      </View>
      <View style={s.reviewBody}>
        <View style={s.reviewTop}>
          <View style={s.reviewer}>
            <Text
              testID={`text-review-customer-${review.id}`}
              style={[s.name, { color: c.foreground }]}
              numberOfLines={1}
            >
              {review.userName || 'Client'}
            </Text>
            <Text style={[s.date, { color: c.mutedForeground }]}>{dateTime(review.createdAt)}</Text>
          </View>
          <View
            accessible
            accessibilityLabel={`${review.rating ?? 'Note non renseignée'} sur 5`}
            style={[s.rating, { backgroundColor: c.accent }]}
          >
            <Text testID={`text-review-rating-${review.id}`} style={[s.ratingText, { color: c.accentForeground }]}>
              {review.rating ?? '—'} / 5
            </Text>
          </View>
        </View>
        <Stars rating={review.rating} />
        <Text testID={`text-review-comment-${review.id}`} style={[s.comment, { color: c.mutedForeground }]}>
          {review.comment || 'Aucun commentaire écrit pour cette visite.'}
        </Text>
      </View>
    </View>
  );
}

export default function ReviewsScreen() {
  const c = useColors();
  const q = useMerchantReviews();
  const bottom = useBottomPad();
  const { width } = useWindowDimensions();
  const horizontalPadding = Math.min(24, Math.max(14, Math.round(width * 0.05)));
  const reviews = q.data ?? [];
  const average = useMemo(() => {
    const ratings = reviews.map((review) => review.rating).filter((rating): rating is number => typeof rating === 'number' && Number.isFinite(rating));
    return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : '—';
  }, [reviews]);
  const written = reviews.filter((review) => Boolean(review.comment?.trim())).length;
  const latest = reviews[0]?.createdAt ? dateTime(reviews[0].createdAt).split(',')[0] : 'Aucune date';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        kicker={q.data ? `${reviews.length} avis publiés` : 'Voix des clients'}
        title="Avis clients"
        onBack={() => router.back()}
        right={<Feather name="message-square" size={22} color={c.primary} />}
      />
      {q.isPending ? <SkeletonCards count={4} /> : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, { paddingHorizontal: horizontalPadding, paddingBottom: bottom }]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
        >
          {q.isError ? (
            <Text accessibilityRole="alert" style={[s.stale, { color: c.destructive }]}>
              Actualisation échouée. Faites glisser vers le bas pour réessayer.
            </Text>
          ) : null}
          {reviews.length === 0 ? (
            <StateView
              icon="message-square"
              title="Aucun avis"
              message="Les retours de vos clients apparaîtront ici."
              actionLabel="Actualiser"
              onAction={() => q.refetch()}
            />
          ) : (
            <>
              <View style={s.stats}>
                <View style={[s.stat, s.darkStat, { backgroundColor: c.ink, borderColor: c.cardBorder }]}>
                  <Text style={[s.eyebrow, { color: c.inkForeground, opacity: 0.62 }]}>Note moyenne</Text>
                  <Text testID="text-average-rating" style={[s.bigValue, { color: c.inkForeground }]}>
                    {average}<Text style={[s.unit, { color: c.accent }]}> / 5</Text>
                  </Text>
                  <Text style={[s.statHint, { color: c.inkForeground, opacity: 0.62 }]}>Sur {reviews.length} avis publiés</Text>
                </View>
                <View style={[s.stat, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
                  <Text style={[s.eyebrow, { color: c.mutedForeground }]}>Notes écrites</Text>
                  <Text style={[s.bigValue, { color: c.foreground }]}>{written}</Text>
                  <Text style={[s.statHint, { color: c.mutedForeground }]}>Avis avec commentaire</Text>
                </View>
                <View style={[s.stat, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
                  <Text style={[s.eyebrow, { color: c.mutedForeground }]}>Dernier signal</Text>
                  <Text style={[s.latest, { color: c.foreground }]} numberOfLines={1}>{latest}</Text>
                  <Text style={[s.statHint, { color: c.mutedForeground }]}>Dernier avis reçu</Text>
                </View>
              </View>
              <View style={[s.list, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }]}>
                <View style={[s.listHeader, { borderBottomColor: c.border }]}>
                  <Text style={[s.listTitle, { color: c.foreground }]}>Avis clients récents</Text>
                </View>
                {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingTop: 4, gap: 16, flexGrow: 1, width: '100%', maxWidth: 920, alignSelf: 'center' },
  stats: { gap: 10 },
  stat: { borderWidth: 1, borderRadius: 16, padding: 16, minHeight: 126 },
  darkStat: { minHeight: 142 },
  eyebrow: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' },
  bigValue: { fontFamily: font.display, fontSize: 34, marginTop: 10 },
  unit: { fontFamily: font.bold, fontSize: 16 },
  latest: { fontFamily: font.display, fontSize: 22, marginTop: 14 },
  statHint: { fontFamily: font.regular, fontSize: 12, marginTop: 5 },
  list: { borderWidth: 1, overflow: 'hidden' },
  listHeader: { borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 15 },
  listTitle: { fontFamily: font.display, fontSize: 18 },
  review: { flexDirection: 'row', gap: 12, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, padding: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 13 },
  reviewBody: { flex: 1, minWidth: 0, gap: 8 },
  reviewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  reviewer: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: font.bold, fontSize: 15 },
  date: { fontFamily: font.regular, fontSize: 12 },
  rating: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  ratingText: { fontFamily: font.bold, fontSize: 12 },
  stars: { flexDirection: 'row', gap: 2 },
  comment: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  stale: { fontFamily: font.medium, fontSize: 12, marginBottom: 2 },
});