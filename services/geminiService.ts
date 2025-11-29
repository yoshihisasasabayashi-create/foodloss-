import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDeliveryUpdate = async (
  weather: string = "晴れ",
  locationContext: string = "住宅街",
  traffic: string = "順調"
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        あなたは老舗和菓子屋「甘味処 gemini」の配達員です。
        現在配達中で、お客様が見ている追跡画面に表示する「ひとことメッセージ」を書いてください。
        
        条件:
        1. 30文字以内の短い日本語。
        2. 丁寧だが親しみやすく、少し風情がある言葉遣い。
        3. 季節感や和菓子の美味しさをほんの少し匂わせる。
        4. 現在の状況: 天気は${weather}、場所は${locationContext}、交通状況は${traffic}です。
        
        例:
        - 桜並木を抜けました。お茶の準備をしてお待ちください。
        - 少し道が混んでいますが、焼きたての香りと共に急いでおります。
        
        出力はメッセージのみにしてください。
      `,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Gemini generation error:", error);
    return "現在、安全運転でお届けに向かっております。";
  }
};