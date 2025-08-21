import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
declare const Drawer: {
    ({ shouldScaleBackground, ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const DrawerTrigger: React.ForwardRefExoticComponent<any>;
declare const DrawerPortal: typeof import("vaul").Portal;
declare const DrawerClose: React.ForwardRefExoticComponent<any>;
declare const DrawerOverlay: React.ForwardRefExoticComponent<Omit<Omit<Omit<any, "ref"> & React.RefAttributes<HTMLDivElement>, "ref">, "ref"> & React.RefAttributes<HTMLDivElement>>;
declare const DrawerContent: React.ForwardRefExoticComponent<Omit<Omit<Omit<any, "ref"> & React.RefAttributes<HTMLDivElement>, "ref">, "ref"> & React.RefAttributes<HTMLDivElement>>;
declare const DrawerHeader: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const DrawerFooter: {
    ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
declare const DrawerTitle: React.ForwardRefExoticComponent<any>;
declare const DrawerDescription: React.ForwardRefExoticComponent<any>;
export { Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription, };
