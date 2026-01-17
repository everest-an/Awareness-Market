import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ReviewDialogProps {
  vectorId: number;
  vectorTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ReviewDialog({ vectorId, vectorTitle, open, onOpenChange, onSuccess }: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const createReviewMutation = trpc.reviews.create.useMutation({
    onSuccess: () => {
      toast.success("Review submitted successfully!");
      onSuccess();
      onOpenChange(false);
      // Reset form
      setRating(0);
      setComment("");
    },
    onError: (error) => {
      toast.error("Failed to submit review", {
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    createReviewMutation.mutate({
      vectorId,
      rating,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
          <DialogDescription>
            Share your experience with {vectorTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rating Stars */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Rating</label>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => {
                const starValue = index + 1;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setRating(starValue)}
                    onMouseEnter={() => setHoverRating(starValue)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        starValue <= (hoverRating || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                );
              })}
              {rating > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {rating} out of 5 stars
                </span>
              )}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Your Review (Optional)
            </label>
            <Textarea
              id="comment"
              placeholder="Share your thoughts about this AI capability..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              maxLength={1000}
            />
            <div className="text-xs text-muted-foreground text-right">
              {comment.length}/1000 characters
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createReviewMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createReviewMutation.isPending || rating === 0}
          >
            {createReviewMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Review"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
