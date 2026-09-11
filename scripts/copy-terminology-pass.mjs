// One-shot copy terminology rewrite for studio-copy.ts (Wave 3).
// Applies [key, en, zh] value replacements in place, en block first.
import { readFileSync, writeFileSync } from 'node:fs';

const REWRITES = [
  ['common.sourceUnavailable', 'Temporarily unavailable', '暂时无法获取'],
  ['common.appLocal', 'Stored only on this device', '仅保存在这台电脑上'],
  ['common.localOnly', 'Stored only on this device', '仅保存在这台电脑上'],
  ['common.realmSave', 'Save', '保存'],
  ['common.candidate', 'Pending your review', '待你确认'],
  ['common.ownerReviewed', 'Reviewed by you', '你已确认'],
  ['common.operationFailed', 'Something went wrong. Try again.', '出错了，请重试。'],
  ['voiceConfig.localBadge', 'Pending your review', '待你确认'],
  ['voiceConfig.demo.description', 'The generated audio stays on this device until you approve it.', '生成的音频在你确认前仅保存在这台电脑上。'],
  ['voiceConfig.boundary.alert', 'No generated voice goes public without your review.', '任何生成的声音都不会在你确认前公开。'],
  ['draftBox.boundary.candidateOnly', 'Pending your review', '待你确认'],
  ['draftBox.boundary.localOnly', 'Stored only on this device', '仅保存在这台电脑上'],
  ['draftBox.description', 'Drafts and media waiting for your review — everything is stored only on this device.', '等待你确认的草稿与素材，全部仅保存在这台电脑上。'],
  ['draftBox.status.needsReview', 'pending your review', '待你确认'],
  ['contentManagement.description', 'Review post drafts, schedules, and media for this persona in one place.', '在这里集中审核这个角色的帖子草稿、排程与素材。'],
  ['portfolio.card.friendCountUnavailable', 'Friends temporarily unavailable', '好友数暂时无法获取'],
  ['shared.worldUnavailable', 'World temporarily unavailable', '世界暂时无法获取'],
  ['shared.fieldStatus.sourceUnavailable', 'Temporarily unavailable', '暂时无法获取'],
  ['portfolio.failure.capabilityUnavailable.title', 'Persona data temporarily unavailable', '角色数据暂时无法获取'],
  ['overview.description', 'Status, next steps, and a local preview for this Realm Persona.', '这个角色的状态、下一步建议与本机预览。'],
  ['overview.nextSteps.empty', 'Nothing needs your attention right now.', '暂无需要处理的事项。'],
  ['identity.visual.coverSourceUnavailable', 'cover temporarily unavailable', '封面暂时无法获取'],
  ['identity.visual.description', 'Change the avatar or prepare new image drafts for your review.', '更换头像，或准备待你确认的新形象草稿。'],
  ['persona.workspace.coverUnavailable', 'Profile cover temporarily unavailable', '封面暂时无法获取'],
  ['persona.workspace.rosterUnavailable', 'Personas temporarily unavailable', '角色列表暂时无法获取'],
  ['posts.workspace.attachmentSourceMissing', 'Local file temporarily unavailable', '本地文件暂时无法获取'],
  ['posts.workspace.queueNeedsReview', 'pending your review', '待你确认'],
  ['posts.workspace.queueBoundary', 'Stored only on this device', '仅保存在这台电脑上'],
  ['posts.error.personaIdentityMissing', 'persona identity temporarily unavailable or missing', '角色身份暂时无法获取或未设置'],
  ['posts.error.scheduleDraftRequired', 'Confirm the post draft before scheduling.', '请先确认帖子草稿再设置提醒。'],
  ['posts.error.scheduleDateTimeRequired', 'Pick a date and time.', '请选择日期和时间。'],
  ['posts.error.scheduleFutureRequired', 'Pick a future time.', '请选择未来的时间。'],
  ['create.world.loadingDescription', 'Loading worlds…', '正在加载世界…'],
  ['create.worldRecovery.submitDisabled', 'Create stays disabled until a selectable world loads.', '在可选择的世界加载完成前，创建按钮保持禁用。'],
  ['create.reference.uploadUnavailable', 'Local image import is not available through the current Desktop connection.', '当前 Desktop 连接尚未提供本地图片导入能力。'],
  ['create.reference.assetsLoadingDescription', 'Reading your reviewed image drafts from the asset library.', '正在从素材库读取你已确认的图片草稿。'],
  ['create.reference.assetsEmptyDescription', 'No reviewed image with a Realm-readable HTTPS link is available yet.', '目前没有带 Realm 可用 HTTPS 链接且已确认的图片。'],
  ['create.reference.assetsPartial', 'Some local asset records are temporarily unavailable; only readable reviewed images are shown.', '部分本地素材记录暂时无法获取，这里只显示可读取且已确认的图片。'],
  ['create.reference.sourceSelected', 'Image draft selected for your review.', '已选择形象草稿，等待你最终确认。'],
  ['create.error.referencePayloadInvalid', 'The reference image input is invalid.', '参考图输入无效。'],
  ['settings.error.runtimeProposalPayloadInvalid', 'The settings suggestion input is invalid.', '设置建议的输入无效。'],
  ['settings.worldUnavailable', 'Home world cannot be changed because the world list could not be loaded. The current home world is kept.', '世界列表加载失败，归属世界暂不可修改，将保留当前归属世界。'],
  ['settingField.ownership', 'Ownership', '所有权'],
  ['settingField.world', 'World', '世界'],
  ['assets.overview.activity.emptyDescription', 'Image and voice drafts you create will appear here.', '你创建的图片和声音草稿会显示在这里。'],
  ['assets.visualChange.assetsDescription', 'Choose from your reviewed image assets', '从你已确认的图片素材中选择'],
  ['assets.voiceNotice', 'Voice demo audio stays on this device for your review because publishing voices is not available yet.', '声音演示音频仅保存在这台电脑上供你确认，因为声音发布尚未开放。'],
  ['assetsLibrary.storageUnavailable', 'Some local storage is temporarily unavailable. The library shows only records that were read successfully.', '部分本地存储暂时无法获取，素材库仅显示成功读取的记录。'],
  ['assetsLibrary.upload.dropzoneDescription', 'Stored only on this device.', '仅保存在这台电脑上。'],
  ['assetsLibrary.upload.capabilityUnavailable', 'Local import is not available in this Desktop environment, so the dropzone is disabled.', '当前 Desktop 环境暂不支持本地导入，导入区已停用。'],
  ['assetsLibrary.review.ownerReviewed', 'Reviewed by you', '你已确认'],
  ['portfolio.noLocalMatchDescription', 'Try a different search or sort. Nothing is saved or changed.', '试试调整搜索或排序，不会保存或修改任何内容。'],
  ['persona.failure.sanitized', 'Something went wrong: {{reason}}', '出错了：{{reason}}'],
  ['failure.kind.generic', 'Something went wrong. Try again.', '出错了，请重试。'],
  ['failure.kind.capabilityUnavailable', 'This feature is not available in the current environment.', '当前环境暂不支持此功能。'],
  ['failure.kind.ownerAuthorityMissing', 'Owner permission is missing for this action.', '缺少执行此操作的所有者权限。'],
  ['shell.protectedSession.state.accessDenied.title', 'This action is not covered by App Access', '此操作未被 App Access 覆盖'],
  ['shell.protectedSession.state.accessDenied.description', 'The current App Access permissions do not cover this action, or the platform does not offer it yet.', '当前 App Access 权限未覆盖此操作，或平台尚未提供该能力。'],
  ['shell.protectedSession.state.capabilityUnavailable.description', 'This feature is not available in the current version and stays disabled.', '当前版本尚未提供此功能，因此保持停用。'],
  ['shell.protectedSession.state.capabilityUnavailable.action', 'Wait for the platform to enable it; direct connections or credential workarounds are not supported.', '请等待平台开放该功能；不支持直连或凭证降级等绕过方式。'],
  ['shell.protectedSession.state.runtimeUnavailable.description', 'This window cannot currently reach the local Nimi Runtime service. No changes were saved.', '此窗口当前无法连接本地 Nimi Runtime 服务，未保存任何更改。'],
];

const path = 'src/shell/renderer/i18n/studio-copy.ts';
const lines = readFileSync(path, 'utf8').split('\n');
const zhStart = lines.findIndex((line) => line.startsWith('export const studioChineseCopy'));
if (zhStart < 0) throw new Error('zh block not found');

const usedAt = new Map();
let misses = 0;
for (const [key, en, zh] of REWRITES) {
  const pattern = `  '${key}':`;
  const enIndex = lines.findIndex((line, index) => index < zhStart && index > (usedAt.get(key) ?? -1) && line.startsWith(pattern));
  const zhIndex = lines.findIndex((line, index) => index > zhStart && line.startsWith(pattern));
  if (enIndex < 0 || zhIndex < 0) {
    console.error(`MISS: ${key} (en=${enIndex} zh=${zhIndex})`);
    misses += 1;
    continue;
  }
  lines[enIndex] = `${pattern} '${en.replaceAll("'", "\\'")}',`;
  lines[zhIndex] = `${pattern} '${zh}',`;
}
console.log(`applied: ${REWRITES.length - misses}/${REWRITES.length}`);
if (misses > 0) process.exit(1);
writeFileSync(path, lines.join('\n'));
