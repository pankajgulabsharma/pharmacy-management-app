/**
 * Who makes and supports MediCare — shown on the sign-in screen
 * ("Powered by …"), in Help & support and on the licence screen.
 *
 * Fill in your real contact details before building the installer.
 * An empty value is simply not shown.
 */
export type Vendor = {
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  hours: string;
};

export const VENDOR: Vendor = {
  company: "Vintez Solution",
  /** Support phone, e.g. "+91 98200 12345" */
  phone: "",
  /** WhatsApp number with country code, digits only, e.g. "919820012345" */
  whatsapp: "",
  email: "",
  website: "",
  /** When someone answers */
  hours: "Mon–Sat, 10 am – 7 pm",
};
