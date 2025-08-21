import * as React from "react";
import * as MenubarPrimitive from "@radix-ui/react-menubar";
declare function MenubarMenu({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Menu>): import("react/jsx-runtime").JSX.Element;
declare function MenubarGroup({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Group>): import("react/jsx-runtime").JSX.Element;
declare function MenubarPortal({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Portal>): import("react/jsx-runtime").JSX.Element;
declare function MenubarRadioGroup({ ...props }: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>): import("react/jsx-runtime").JSX.Element;
declare function MenubarSub({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Sub>): import("react/jsx-runtime").JSX.Element;
declare const Menubar: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarTrigger: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarSubTrigger: React.ForwardRefExoticComponent<Omit<Omit<any, "ref"> & {
    inset?: boolean;
}, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarSubContent: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarContent: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarItem: React.ForwardRefExoticComponent<Omit<Omit<any, "ref"> & {
    inset?: boolean;
}, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarCheckboxItem: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarRadioItem: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarLabel: React.ForwardRefExoticComponent<Omit<Omit<any, "ref"> & {
    inset?: boolean;
}, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarSeparator: React.ForwardRefExoticComponent<Omit<Omit<any, "ref">, "ref"> & React.RefAttributes<unknown>>;
declare const MenubarShortcut: {
    ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>): import("react/jsx-runtime").JSX.Element;
    displayname: string;
};
export { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarLabel, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarPortal, MenubarSubContent, MenubarSubTrigger, MenubarGroup, MenubarSub, MenubarShortcut, };
