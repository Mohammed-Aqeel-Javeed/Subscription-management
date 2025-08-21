import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { type VariantProps } from "class-variance-authority";
declare const Sheet: any;
declare const SheetTrigger: any;
declare const SheetClose: any;
declare const SheetPortal: any;
declare const SheetOverlay: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const sheetVariants: (props?: ({
    side?: "left" | "right" | "top" | "bottom" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>, VariantProps<typeof sheetVariants> {
}
declare const SheetContent: React.ForwardRefExoticComponent<Omit<SheetContentProps, "ref"> & React.RefAttributes<unknown>>;
declare const SheetHeader: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const SheetFooter: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const SheetTitle: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const SheetDescription: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, };
