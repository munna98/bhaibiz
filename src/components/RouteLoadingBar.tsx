import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function RouteLoadingBar() {
  const isLoading = useRouterState({
    select: (s) => s.status === "pending" || s.isLoading,
  });
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      setVisible(true);
      setProgress(20);
      t1 = setTimeout(() => {
        setProgress(65);
      }, 100);
      t2 = setTimeout(() => {
        setProgress(85);
      }, 400);
    } else {
      setProgress(100);
      t1 = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    }

    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Page loading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className="fixed inset-x-0 top-0 z-50 h-1 bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-primary transition-all duration-200 ease-out shadow-xs shadow-primary"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: "width, opacity",
        }}
      />
    </div>
  );
}
