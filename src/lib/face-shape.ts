import { useCallback, useEffect, useState } from "react";

export type FaceShape = "square" | "round";

const KEY = "apex.faceShape";

function detect(): FaceShape {
  if (typeof window === "undefined") return "square";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "round" || stored === "square") return stored;
  return window.matchMedia?.("(shape: round)").matches ? "round" : "square";
}

function apply(shape: FaceShape) {
  const root = document.documentElement;
  root.classList.toggle("face-round", shape === "round");
  root.classList.toggle("face-square", shape === "square");
  root.dataset["face"] = shape;
}

/** Watch face shape: square faces run edge-to-edge, round faces get a circular safe area. */
export function useFaceShape() {
  const [shape, setShape] = useState<FaceShape>("square");

  useEffect(() => {
    const initial = detect();
    setShape(initial);
    apply(initial);
  }, []);

  const toggle = useCallback(() => {
    setShape((prev) => {
      const next: FaceShape = prev === "round" ? "square" : "round";
      window.localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  }, []);

  return { shape, toggle };
}
