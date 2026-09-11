/**
 * Nhãn hãng / loại model cho trang /ai-usage. Chuỗi nằm ở `messages/`; file này chỉ tra khoá.
 */

import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"aiUsage">>;

export function vendorShortLabel(t: Translate, id: string): string {
  switch (id) {
    case "claude":
      return t("vendorLabelShort.claude");
    case "openai":
      return t("vendorLabelShort.openai");
    case "grok":
      return t("vendorLabelShort.grok");
    case "gemini":
      return t("vendorLabelShort.gemini");
    case "deepseek":
      return t("vendorLabelShort.deepseek");
    case "mistral":
      return t("vendorLabelShort.mistral");
    case "flux":
      return t("vendorLabelShort.flux");
    case "stability":
      return t("vendorLabelShort.stability");
    case "ideogram":
      return t("vendorLabelShort.ideogram");
    case "runway":
      return t("vendorLabelShort.runway");
    case "kling":
      return t("vendorLabelShort.kling");
    case "luma":
      return t("vendorLabelShort.luma");
    case "seedance":
      return t("vendorLabelShort.seedance");
    case "pika":
      return t("vendorLabelShort.pika");
    case "hailuo":
      return t("vendorLabelShort.hailuo");
    default:
      return id;
  }
}

export function vendorLabel(t: Translate, id: string): string {
  switch (id) {
    case "claude":
      return t("vendorLabel.claude");
    case "openai":
      return t("vendorLabel.openai");
    case "grok":
      return t("vendorLabel.grok");
    case "gemini":
      return t("vendorLabel.gemini");
    case "deepseek":
      return t("vendorLabel.deepseek");
    case "mistral":
      return t("vendorLabel.mistral");
    case "flux":
      return t("vendorLabel.flux");
    case "stability":
      return t("vendorLabel.stability");
    case "ideogram":
      return t("vendorLabel.ideogram");
    case "runway":
      return t("vendorLabel.runway");
    case "kling":
      return t("vendorLabel.kling");
    case "luma":
      return t("vendorLabel.luma");
    case "seedance":
      return t("vendorLabel.seedance");
    case "pika":
      return t("vendorLabel.pika");
    case "hailuo":
      return t("vendorLabel.hailuo");
    default:
      return id;
  }
}

export function modalityLabel(t: Translate, id: string): string {
  switch (id) {
    case "chat":
      return t("modality.chat");
    case "image":
      return t("modality.image");
    case "video":
      return t("modality.video");
    default:
      return id;
  }
}
