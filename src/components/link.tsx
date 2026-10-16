"use client";
import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="navigation-progress" role="status">
      Finding your next good thing…
    </span>
  ) : null;
}

export default function Link(props: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props}>
      {props.children}
      <PendingNavigation />
    </NextLink>
  );
}
