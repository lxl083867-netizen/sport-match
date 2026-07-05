import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import TagBadge from "@/components/TagBadge";
import FeedbackForm from "@/components/FeedbackForm";
import VideoPlayer from "@/components/VideoPlayer";
import CheckInButton from "@/components/CheckInButton";
import BackButton from "@/components/BackButton";
import AddToPlanButton from "@/components/AddToPlanButton";
import SoloWorkout from "@/components/SoloWorkout";
import DeleteVideoButton from "@/components/DeleteVideoButton";
import EditVideoButton from "@/components/EditVideoButton";
import { PlatformLabel } from "@/components/PlatformLogo";
import { isEmbeddablePlatform } from "@/lib/platform";
import { prioritizeTags, categoryColorMap, type FitnessLevel } from "@/lib/tag-display";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "未知";
  return `${Math.floor(seconds / 60)} 分钟`;
}

export default async function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  // Check if current user has imported this video (via UserVideo)
  const isImported = userId
    ? !!(await prisma.userVideo.findUnique({ where: { userId_videoId: { userId, videoId: id } } }))
    : false;

  const video = await prisma.video.findUnique({
    where: { id },
    select: {
      id: true, title: true, url: true, platform: true, duration: true, thumbnailUrl: true,
      sourceAuthor: true, sourceAuthorId: true, userId: true, createdAt: true,
      tags: { include: { tag: true } },
      feedbacks: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { feedbacks: true } },
    },
  });
  if (!video) notFound();

  // Only the original importer can edit global info (title/author)
  const isOriginalImporter = !!(userId && video.userId === userId);

  let existingFeedback = null;
  let recentCheckInCount = 0;
  let totalCheckInCount = 0;
  let fitnessLevel: FitnessLevel | null = null;

  if (userId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [feedback, recentCheckins, totalCheckins, profile] = await Promise.all([
      prisma.userFeedback.findUnique({
        where: { userId_videoId: { userId, videoId: id } },
      }),
      prisma.videoCheckIn.count({
        where: { videoId: id, createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.videoCheckIn.count({
        where: { videoId: id },
      }),
      prisma.userProfile.findUnique({ where: { userId } }),
    ]);
    existingFeedback = feedback;
    recentCheckInCount = recentCheckins;
    totalCheckInCount = totalCheckins;
    if (profile) fitnessLevel = profile.fitnessLevel as FitnessLevel;
  }

  const totalFeedbacks = video._count.feedbacks;
  const recommendCount = video.feedbacks.filter((f) => f.recommend).length;

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <BackButton fallback="/videos" label="返回" />

      {/* Video player */}
      <div className="bg-[var(--color-surface)] rounded-[20px] border border-[var(--color-border)] mb-6">
        <div className="rounded-t-[20px] overflow-hidden">
          <VideoPlayer
            title={video.title}
            url={video.url}
            platform={video.platform}
            duration={video.duration}
          />
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformLabel platform={video.platform} />
            <span className="text-[13px] text-[var(--color-text-secondary)]">@{video.sourceAuthor}</span>
            <span className="text-[13px] text-[var(--color-text-tertiary)]">{formatDuration(video.duration)}</span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            {isImported && (
              <span className="text-[11px] font-medium bg-[var(--color-brand-subtle)] text-[var(--color-brand)] px-2 py-0.5 rounded-full shrink-0">已导入</span>
            )}
            <h1 className="text-[22px] font-semibold tracking-[-0.022em]">{video.title}</h1>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {prioritizeTags(
              video.tags.map((vt) => ({ name: vt.tag.name, category: vt.tag.category, nameZh: vt.tag.nameZh, confidence: vt.confidence, evidence: vt.evidence ?? undefined })),
              fitnessLevel,
              6
            ).map((t) => (
              <TagBadge key={t.name} label={t.displayLabel} size="sm" color={categoryColorMap[t.category] || "default"} />
            ))}
            {video.tags.length > 6 && (
              <span className="text-[11px] text-[var(--color-text-tertiary)] self-center ml-1">
                +{video.tags.length - 6}
              </span>
            )}
          </div>

          {video.tags.some((vt) => vt.evidence) && (
            <details className="text-[12px] text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] rounded-xl p-3 mb-4">
              <summary className="cursor-pointer font-medium text-[var(--color-text-primary)]">AI 标签依据</summary>
              <ul className="mt-2 space-y-1">
                {video.tags.filter((vt) => vt.evidence).map((vt) => (
                  <li key={vt.id}><span className="font-medium">{vt.tag.nameZh}</span> ({Math.round(vt.confidence * 100)}%) — {vt.evidence}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <SoloWorkout
              video={{
                id: video.id,
                title: video.title,
                url: video.url,
                platform: video.platform,
                duration: video.duration,
                sourceAuthor: video.sourceAuthor,
              }}
            />
            <CheckInButton
              videoId={video.id}
              initialRecentCount={recentCheckInCount}
              initialTotalCount={totalCheckInCount}
              userId={userId}
            />
            <AddToPlanButton
              videoId={video.id}
              videoTitle={video.title}
              userId={userId}
            />
            <EditVideoButton
              videoId={video.id}
              title={video.title}
              sourceAuthor={video.sourceAuthor}
              isImported={isOriginalImporter}
            />
            <DeleteVideoButton
              videoId={video.id}
              isImported={isImported}
            />
          </div>

          {/* Discovery entry points — find alternatives without judging whether this video is broken */}
          <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
            {video.tags.length > 0 && (() => {
              const mainTag = video.tags.find((vt) => vt.tag.category === "goal")?.tag
                || video.tags.find((vt) => vt.tag.category === "type")?.tag
                || video.tags[0].tag;
              return (
                <Link
                  href={`/videos?tag=${encodeURIComponent(mainTag.nameZh)}`}
                  className="text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] transition-colors"
                >
                  找相似 · {mainTag.nameZh}
                </Link>
              );
            })()}
            {!isEmbeddablePlatform(video.platform) && (
              <Link
                href="/videos?platform=bilibili"
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] transition-colors"
              >
                找可站内播放的替代视频
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Feedback stats */}
      {totalFeedbacks > 0 && (
        <div className="bg-[var(--color-surface)] rounded-[20px] border border-[var(--color-border)] p-6 mb-6">
          <h2 className="text-[17px] font-semibold mb-4">用户反馈</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-[var(--color-surface-secondary)] rounded-xl p-3">
              <p className="text-[26px] font-semibold tracking-tight">{totalFeedbacks}</p>
              <p className="text-[12px] text-[var(--color-text-tertiary)]">总反馈数</p>
            </div>
            <div className="bg-[#e8f8ed] rounded-xl p-3">
              <p className="text-[26px] font-semibold tracking-tight text-[#1d7a3f]">{totalFeedbacks > 0 ? Math.round((recommendCount / totalFeedbacks) * 100) : 0}%</p>
              <p className="text-[12px] text-[#1d7a3f]/70">推荐率</p>
            </div>
            <div className="bg-[var(--color-brand-subtle)] rounded-xl p-3">
              <p className="text-[26px] font-semibold tracking-tight text-[var(--color-brand)]">
                {video.feedbacks.filter((f) => f.difficultyRating === "just_right").length}
              </p>
              <p className="text-[12px] text-[var(--color-brand)]/70">觉得刚好</p>
            </div>
            <div className="bg-[#fef3e8] rounded-xl p-3">
              <p className="text-[26px] font-semibold tracking-tight text-[#b05a10]">
                {video.feedbacks.filter((f) => f.completionRate === "fully").length}
              </p>
              <p className="text-[12px] text-[#b05a10]/70">完整跟练</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {video.feedbacks.slice(0, 5).map((fb) => (
              <div key={fb.id} className="text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] rounded-xl px-4 py-2.5 flex items-center gap-3">
                <span className="font-medium text-[var(--color-text-primary)] shrink-0">{fb.user.name || "匿名"}</span>
                <span>{fb.recommend ? "👍" : "👎"}</span>
                <span>{fb.difficultyRating === "too_easy" ? "太简单" : fb.difficultyRating === "just_right" ? "刚好" : "太难"}</span>
                <span>·</span>
                <span>{fb.completionRate === "fully" ? "完整跟练" : fb.completionRate === "partial" ? "部分完成" : "中途放弃"}</span>
                {fb.notes && <span className="text-[var(--color-text-tertiary)] truncate">— {fb.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback form */}
      {userId ? (
        <FeedbackForm videoId={video.id} existingFeedback={existingFeedback ? {
          difficultyRating: existingFeedback.difficultyRating, bodyFeeling: existingFeedback.bodyFeeling,
          completionRate: existingFeedback.completionRate, recommend: existingFeedback.recommend, notes: existingFeedback.notes,
        } : null} />
      ) : (
        <div className="bg-[var(--color-surface)] rounded-[20px] border border-[var(--color-border)] p-6 text-center">
          <p className="text-[14px] text-[var(--color-text-secondary)]">
            <a href="/auth/login" className="text-[var(--color-brand)] hover:underline">登录</a> 后可提交反馈
          </p>
        </div>
      )}
    </div>
  );
}
