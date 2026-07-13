/**
 * 生成AIモデル名（Cloud Run の環境変数で上書き可能）
 * - デフォルト: gemini-3.1-flash-lite（高頻度・軽量タスク向けの最もコスト効率の良いモデル）
 * - 環境変数 GEMINI_FLASH_MODEL で上書き可能
 */
const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.1-flash-lite';

module.exports = { GEMINI_FLASH_MODEL };
