declare global {
  interface RequestInit {
    /** Optional application-level cache bypass understood by apiRequest. */
    skipCache?: boolean;
  }
}

export {};
