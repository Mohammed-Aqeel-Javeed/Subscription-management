declare module "drizzle-kit";
// Workaround for missing type declarations in @radix-ui/react-tabs
declare module "@radix-ui/react-tabs";

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Image declarations
declare module "*.png" {
  const content: string;
  export default content;
}
declare module "*.jpg" {
  const content: string;
  export default content;
}
declare module "*.svg" {
  const content: string;
  export default content;
}
// Workarounds for other missing Radix UI type declarations
declare module "@radix-ui/react-accordion";
declare module "@radix-ui/react-alert-dialog";
declare module "@radix-ui/react-aspect-ratio";
declare module "@radix-ui/react-avatar";
declare module "@radix-ui/react-checkbox";
declare module "@radix-ui/react-context-menu";
declare module "@radix-ui/react-dialog";
declare module "@radix-ui/react-dropdown-menu";
declare module "@radix-ui/react-hover-card";
declare module "@radix-ui/react-label";
declare module "@radix-ui/react-menubar";
declare module "@radix-ui/react-navigation-menu";
declare module "@radix-ui/react-popover";
declare module "@radix-ui/react-progress";
declare module "@radix-ui/react-radio-group";
declare module "@radix-ui/react-scroll-area";
declare module "@radix-ui/react-select";
declare module "@radix-ui/react-separator";
declare module "@radix-ui/react-slider";
declare module "@radix-ui/react-switch";
declare module "@radix-ui/react-toggle-group";
declare module "@radix-ui/react-toggle";
declare module "@radix-ui/react-tooltip";
declare module "tailwind-merge";
declare module "drizzle-orm/pg-core";
declare module "drizzle-zod";
