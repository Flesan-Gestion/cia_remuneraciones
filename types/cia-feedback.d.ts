import type { DetailedHTMLProps, HTMLAttributes } from "react";

type CiaFeedbackAttrs = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  "data-plataforma"?: string;
  "data-endpoint"?: string;
  "data-titulo"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "cia-feedback": CiaFeedbackAttrs;
    }
  }
}
