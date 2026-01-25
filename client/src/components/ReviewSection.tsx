import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, Edit2, Trash2 } from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { getLoginUrl } from "@/const";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReviewSectionProps {
  vectorId: number;
}

export function ReviewSection({ vectorId }: ReviewSectionProps) {
  const { user } = useAuth();
  // Toast functionality removed for simplicity
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: reviews, isLoading: reviewsLoading } = trpc.reviews.getByVector.useQuery({ vectorId });
  const { data: stats } = trpc.reviews.getStats.useQuery({ vectorId });
  const { data: myReviews } = trpc.reviews.myReviews.useQuery(undefined, { enabled: !!user });

  const createReview = trpc.reviews.create.useMutation({
    onSuccess: () => {
      alert("Review submitted successfully!");
      setRating(0);
      setComment("");
      utils.reviews.getByVector.invalidate({ vectorId });
      utils.reviews.getStats.invalidate({ vectorId });
      utils.reviews.myReviews.invalidate();
    },
    onError: (error) => {
      alert(`Failed to submit review: ${error.message}`);
    },
  });

  const updateReview = trpc.reviews.update.useMutation({
    onSuccess: () => {
      alert("Review updated successfully!");
      setEditingReview(null);
      utils.reviews.getByVector.invalidate({ vectorId });
      utils.reviews.getStats.invalidate({ vectorId });
      utils.reviews.myReviews.invalidate();
    },
    onError: (error) => {
      alert(`Failed to update review: ${error.message}`);
    },
  });

  const deleteReview = trpc.reviews.delete.useMutation({
    onSuccess: () => {
      alert("Review deleted successfully!");
      utils.reviews.getByVector.invalidate({ vectorId });
      utils.reviews.getStats.invalidate({ vectorId });
      utils.reviews.myReviews.invalidate();
    },
    onError: (error) => {
      alert(`Failed to delete review: ${error.message}`);
    },
  });

  const handleSubmit = async () => {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }

    if (rating === 0) {
      alert("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      await createReview.mutateAsync({
        vectorId,
        rating,
        comment: comment.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingReview) return;

    await updateReview.mutateAsync({
      id: editingReview.review.id,
      rating: editingReview.rating,
      comment: editingReview.comment,
    });
  };

  const handleDelete = async (reviewId: number) => {
    if (confirm("Are you sure you want to delete this review?")) {
      await deleteReview.mutateAsync({ id: reviewId });
    }
  };

  // Check if user has already reviewed
  const userReview = myReviews?.find((r) => r.review.vectorId === vectorId);

  return (
    <div className="space-y-6">
      {/* Rating Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Ratings & Reviews</CardTitle>
            <CardDescription>
              {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
              {stats.verifiedPurchases > 0 && (
                <span className="ml-2 text-green-600">
                  ({stats.verifiedPercentage.toFixed(0)}% verified purchases)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold">{stats.averageRating.toFixed(1)}</div>
                <div className="flex items-center justify-center mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= Math.round(stats.averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.ratingDistribution[star as keyof typeof stats.ratingDistribution] || 0;
                  const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <div className="w-12 text-sm">{star} ★</div>
                      <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm text-right">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Write Review */}
      {!userReview && (
        <Card>
          <CardHeader>
            <CardTitle>Write a Review</CardTitle>
            <CardDescription>Share your experience with this AI capability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Your Rating</div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Your Review (Optional)</div>
              <Textarea
                placeholder="Tell others about your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </div>

            <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* User's Existing Review */}
      {userReview && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your Review
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= userReview.review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                  {userReview.review.isVerifiedPurchase && (
                    <span className="text-xs text-green-600 font-medium">Verified Purchase</span>
                  )}
                </div>
                {userReview.review.comment && (
                  <p className="text-sm text-muted-foreground">{userReview.review.comment}</p>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {new Date(userReview.review.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingReview({
                    ...userReview,
                    rating: userReview.review.rating,
                    comment: userReview.review.comment || "",
                  })}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(userReview.review.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>All Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <div key={review.id} className="border-b pb-4 last:border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium">{review.userName || "Anonymous"}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                        {review.isVerifiedPurchase && (
                          <span className="text-xs text-green-600 font-medium">Verified Purchase</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No reviews yet. Be the first to review!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Review Dialog */}
      <Dialog open={!!editingReview} onOpenChange={() => setEditingReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Your Review</DialogTitle>
            <DialogDescription>Update your rating and comment</DialogDescription>
          </DialogHeader>
          {editingReview && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Your Rating</div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditingReview({ ...editingReview, rating: star })}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= editingReview.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Your Review</div>
                <Textarea
                  value={editingReview.comment}
                  onChange={(e) => setEditingReview({ ...editingReview, comment: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReview(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
