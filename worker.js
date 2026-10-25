/**
 * 치지직 멀티뷰용 중계 서버 (Cloudflare Worker, 무료 플랜으로 충분)
 *
 * 배포:
 *   1) https://dash.cloudflare.com → Workers & Pages → Create → "Hello World" 워커 생성
 *   2) 이 파일 내용을 전부 붙여넣고 Deploy
 *   3) 발급된 주소(https://xxxx.workers.dev)를 멀티뷰 설정 > "중계 서버 주소"에 입력
 *
 * (선택) 성인 인증이 필요한 방송까지 보려면 Worker 설정 > Variables and Secrets 에
 *   NID_AUT, NID_SES  두 개를 Secret 으로 등록 (본인 네이버 로그인 쿠키 값).
 *   ※ 쿠키는 본인 계정 정보이므로 절대 타인과 공유하지 마세요.
 *
 * (선택) 접근 제한: ALLOWED_ORIGIN 변수에 멀티뷰 페이지 주소(예: https://me.github.io)를 넣으면
 *   그 출처에서만 호출 가능.
 */

const CHZZK_API = "https://api.chzzk.naver.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";
    const cors = corsHeaders(env, origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      if (url.pathname === "/search") {
        const q = url.searchParams.get("q") || "";
        if (!q.trim()) return json({ data: [] }, cors);
        const r = await chzzk(
          `/service/v1/search/channels?keyword=${encodeURIComponent(q)}&offset=0&size=20`,
          env
        );
        const list = (r?.content?.data || []).map((d) => ({
          channelId: d.channel.channelId,
          channelName: d.channel.channelName,
          channelImageUrl: d.channel.channelImageUrl,
          verified: !!d.channel.verifiedMark,
          openLive: !!d.channel.openLive,
          followerCount: d.channel.followerCount ?? null,
        }));
        return json({ data: list }, cors);
      }

      if (url.pathname.startsWith("/channel/")) {
        const id = url.pathname.split("/")[2];
        const r = await chzzk(`/service/v1/channels/${id}`, env);
        const c = r?.content;
        if (!c?.channelId) return json({ error: "NOT_FOUND" }, cors, 404);
        return json(
          {
            channelId: c.channelId,
            channelName: c.channelName,
            channelImageUrl: c.channelImageUrl,
            openLive: !!c.openLive,
          },
          cors
        );
      }

      if (url.pathname.startsWith("/live/")) {
        const id = url.pathname.split("/")[2];
        const r = await chzzk(`/service/v3/channels/${id}/live-detail`, env);
        const c = r?.content;
        if (!c) return json({ status: "CLOSE" }, cors);
        let hls = null,
          llhls = null;
        if (c.livePlaybackJson) {
          try {
            const pb = JSON.parse(c.livePlaybackJson);
            for (const m of pb.media || []) {
              if (m.mediaId === "HLS") hls = m.path;
              if (m.mediaId === "LLHLS") llhls = m.path;
            }
          } catch (_) {}
        }
        return json(
          {
            status: c.status, // OPEN | CLOSE
            liveTitle: c.liveTitle,
            liveImageUrl: (c.liveImageUrl || "").replace("{type}", "480"),
            adult: !!c.adult,
            viewers: c.concurrentUserCount ?? null,
            category: c.liveCategoryValue || null,
            hls,
            llhls,
          },
          cors
        );
      }

      // HLS 프록시 (스트림 서버가 CORS를 막는 경우에만 앱이 자동으로 사용)
      if (url.pathname === "/hls") {
        const target = url.searchParams.get("url");
        if (!target || !/^https:\/\/[a-z0-9.-]*(pstatic\.net|naver\.com|navercorp\.com)\//i.test(target))
          return json({ error: "BAD_URL" }, cors, 400);
        const up = await fetch(target, { headers: { "User-Agent": UA, Referer: "https://chzzk.naver.com/" } });
        const ct = up.headers.get("content-type") || "";
        const h = new Headers(cors);
        h.set("Content-Type", ct);
        h.set("Cache-Control", "no-store");
        if (ct.includes("mpegurl") || target.includes(".m3u8")) {
          const text = await up.text();
          const base = new URL(target);
          const self = `${url.origin}/hls?url=`;
          const rewritten = text
            .split("\n")
            .map((line) => {
              const t = line.trim();
              if (!t) return line;
              if (t.startsWith("#")) {
                return t.replace(/URI="([^"]+)"/g, (_, u) => `URI="${self}${encodeURIComponent(new URL(u, base).href)}"`);
              }
              return self + encodeURIComponent(new URL(t, base).href);
            })
            .join("\n");
          return new Response(rewritten, { status: up.status, headers: h });
        }
        return new Response(up.body, { status: up.status, headers: h });
      }

      return json({ ok: true, endpoints: ["/search?q=", "/channel/:id", "/live/:id", "/hls?url="] }, cors);
    } catch (e) {
      return json({ error: String(e) }, cors, 500);
    }
  },
};

async function chzzk(path, env) {
  const headers = { "User-Agent": UA, Accept: "application/json", Referer: "https://chzzk.naver.com/" };
  if (env.NID_AUT && env.NID_SES) headers.Cookie = `NID_AUT=${env.NID_AUT}; NID_SES=${env.NID_SES}`;
  const r = await fetch(CHZZK_API + path, { headers });
  return r.json();
}

function corsHeaders(env, origin) {
  const allow = env.ALLOWED_ORIGIN ? (origin === env.ALLOWED_ORIGIN ? origin : "null") : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    Vary: "Origin",
  };
}

function json(obj, cors, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
