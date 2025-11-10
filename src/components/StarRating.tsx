import { useState } from "react";

interface StarRatingProps {
  rating?: number;
  onRatingChange?: (rating: number) => void;
  interactive?: boolean;
  size?: "sm" | "md" | "lg";
}

export function StarRating({
  rating = 0,
  onRatingChange,
  interactive = false,
  size = "md"
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const [animatingStars, setAnimatingStars] = useState<Set<number>>(new Set());

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };

  const handleClick = (selectedRating: number) => {
    if (!interactive || !onRatingChange) return;

    // Trigger bounce animation
    setAnimatingStars(new Set([selectedRating]));
    setTimeout(() => setAnimatingStars(new Set()), 600);

    onRatingChange(selectedRating);
  };

  const displayRating = interactive && hoverRating > 0 ? hoverRating : rating;

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= displayRating;
        const isAnimating = animatingStars.has(star);
        const fillPercentage =
          star <= Math.floor(displayRating)
            ? 100
            : star === Math.ceil(displayRating)
            ? (displayRating % 1) * 100
            : 0;

        return (
          <button
            key={star}
            onClick={() => handleClick(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            disabled={!interactive}
            className={`relative transition-all duration-200 ${
              interactive ? "cursor-pointer hover:scale-125" : "cursor-default"
            } ${isAnimating ? "animate-bounce-star" : ""}`}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            <svg
              className={`${sizeClasses[size]} transition-all duration-300 drop-shadow-lg`}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id={`fill-gradient-${star}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset={`${fillPercentage}%`}
                    stopColor={isFilled ? "#FBBF24" : "transparent"}
                    className="transition-all duration-500"
                  />
                  <stop
                    offset={`${fillPercentage}%`}
                    stopColor="transparent"
                    className="transition-all duration-500"
                  />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Star outline */}
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill={`url(#fill-gradient-${star})`}
                stroke={
                  isFilled || (interactive && hoverRating >= star)
                    ? "#F59E0B"
                    : "#475569"
                }
                strokeWidth="1.5"
                className="transition-all duration-300"
                filter={isFilled ? "url(#glow)" : "none"}
              />
            </svg>
          </button>
        );
      })}

      {rating > 0 && (
        <span className="ml-2 text-slate-400">{rating.toFixed(1)}</span>
      )}

      <style>{`
        @keyframes bounce-star {
          0%, 100% {
            transform: scale(1) translateY(0);
          }
          25% {
            transform: scale(1.3) translateY(-6px) rotate(15deg);
          }
          50% {
            transform: scale(1.15) translateY(-3px) rotate(-10deg);
          }
          75% {
            transform: scale(1.25) translateY(-5px) rotate(5deg);
          }
        }
        
        .animate-bounce-star {
          animation: bounce-star 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>
    </div>
  );
}
