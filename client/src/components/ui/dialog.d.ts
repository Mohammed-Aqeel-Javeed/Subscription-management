import * as React from "react";
declare const Dialog: any;
declare const DialogTrigger: any;
declare const DialogPortal: any;
declare const DialogClose: any;
declare const DialogOverlay: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const DialogContent: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const DialogHeader: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const DialogFooter: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const DialogTitle: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const DialogDescription: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, };
