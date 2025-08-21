import type { Subscription } from "@shared/schema";
interface SubscriptionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subscription?: Subscription;
}
export default function SubscriptionModal({ open, onOpenChange, subscription }: SubscriptionModalProps): import("react/jsx-runtime").JSX.Element;
export {};
