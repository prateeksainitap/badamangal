import type { Metadata } from "next";

/**
 * /akanksha — a private, link-only creator collaboration brief for
 * Akanksha Awasthi (Bhukkad Ghumakkad). Mirrors the PDF one-pager but
 * built responsive for phones (it opens inside the Instagram in-app
 * browser). noindex so it never shows up in search; it is meant to be
 * shared as a direct link, not discovered.
 *
 * Reusable pattern: copy this folder to /<creator> and swap the
 * curated-for line + the "why you" paragraph per creator.
 */
export const metadata: Metadata = {
  title: "Creator Collaboration Brief · Bada Mangal",
  description: "A collaboration brief from badamangal.com.",
  robots: { index: false, follow: false },
};

const CSS = `
.brief * { margin: 0; padding: 0; box-sizing: border-box; }
.brief {
  --sindoor:#C8102E; --saffron:#FC6011; --saffron-soft:#F2944C;
  --gold:#C9A24A; --cream:#FAF6EE; --cream-deep:#F3EAD7;
  --ink:#231A13; --ink-soft:#5B4B3A;
  background:#EFE7D7; min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
  color:var(--ink); line-height:1.55; padding:0 0 40px;
}
.brief .card {
  max-width:760px; margin:0 auto; background:var(--cream);
  box-shadow:0 10px 40px rgba(0,0,0,0.10);
}
.brief .topband {
  background:linear-gradient(120deg,var(--sindoor) 0%,var(--saffron) 70%,var(--saffron-soft) 100%);
  color:#fff; padding:24px 26px 22px; position:relative;
}
.brief .topband::after { content:""; position:absolute; left:0; right:0; bottom:0; height:4px; background:var(--gold); }
.brief .brandrow { display:flex; align-items:center; justify-content:space-between; }
.brief .brand { display:flex; align-items:center; gap:12px; }
.brief .brand img { height:34px; display:block; }
.brief .tag { font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.92; }
.brief .flag { font-size:20px; }
.brief .doctitle { font-family:Georgia,serif; font-size:27px; font-weight:700; margin-top:14px; letter-spacing:-.3px; }
.brief .docsub { font-size:13px; opacity:.95; margin-top:4px; }
.brief .body { padding:24px 26px 8px; }
.brief .to {
  border-left:3px solid var(--saffron); background:var(--cream-deep);
  padding:11px 15px; border-radius:0 10px 10px 0; margin-bottom:18px;
}
.brief .to b { color:var(--sindoor); font-size:14px; display:block; }
.brief .to span { color:var(--ink-soft); font-size:12.5px; }
.brief h2 {
  font-family:Georgia,serif; color:var(--sindoor); font-size:17px;
  margin:20px 0 8px; display:flex; align-items:center; gap:9px;
}
.brief h2::before { content:""; width:8px; height:8px; background:var(--saffron); border-radius:50%; flex:none; }
.brief p { margin-bottom:9px; font-size:14.5px; }
.brief strong { color:var(--sindoor); }
.brief .stats { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0 4px; }
.brief .stat {
  flex:1 1 calc(50% - 5px); text-align:center; background:#fff;
  border:1px solid rgba(201,162,74,.5); border-radius:12px; padding:14px 8px;
}
.brief .stat .num { font-family:Georgia,serif; font-size:23px; font-weight:700; color:var(--saffron); line-height:1; }
.brief .stat .lab { font-size:10px; text-transform:uppercase; letter-spacing:.6px; color:var(--ink-soft); margin-top:6px; }
.brief ul { list-style:none; margin:6px 0 10px; }
.brief ul li { position:relative; padding-left:20px; margin-bottom:6px; font-size:14.5px; }
.brief ul li::before { content:"\\2022"; position:absolute; left:3px; color:var(--saffron); font-weight:700; }
.brief .twocol { display:flex; flex-wrap:wrap; gap:14px; }
.brief .opt { flex:1 1 260px; background:#fff; border:1px solid rgba(201,162,74,.5); border-radius:12px; padding:15px 17px; }
.brief .opt h3 { font-size:14px; color:var(--sindoor); margin-bottom:6px; }
.brief .opt .mins { display:inline-block; font-size:10px; background:var(--saffron); color:#fff; border-radius:20px; padding:3px 10px; margin-bottom:8px; letter-spacing:.4px; }
.brief .opt p { margin-bottom:0; }
.brief .ask { background:var(--cream-deep); border-radius:12px; padding:15px 18px; margin-top:8px; }
.brief .ask h2 { margin-top:0; }
.brief .note { background:#fff; border:1px dashed var(--gold); border-radius:12px; padding:15px 18px; margin-top:14px; }
.brief .note h2 { margin-top:0; }
.brief .note p:last-child { margin-bottom:0; }
.brief .footer {
  border-top:3px solid var(--gold); background:#fff; padding:16px 26px;
  font-size:12px; color:var(--ink-soft); display:flex; flex-wrap:wrap; gap:6px 16px; justify-content:space-between;
}
.brief .footer .sign { color:var(--sindoor); font-weight:700; }
.brief .footer .made { font-style:italic; }
.brief a { color:var(--sindoor); }
@media (max-width:520px){
  .brief .doctitle { font-size:23px; }
  .brief .topband { padding:20px 18px 18px; }
  .brief .body { padding:20px 18px 6px; }
}
`;

export default function AkankshaBriefPage() {
  return (
    <div className="brief">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="card">
        <div className="topband">
          <div className="brandrow">
            <div className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/Final-Logo-BM-white.svg" alt="Bada Mangal" />
              <span className="tag">badamangal.com</span>
            </div>
            <span className="flag">🚩</span>
          </div>
          <div className="doctitle">Creator Collaboration Brief</div>
          <div className="docsub">
            Lucknow&apos;s live Bada Mangal bhandara map · Bada Mangal 2026
          </div>
        </div>

        <div className="body">
          <div className="to">
            <b>Curated for Akanksha Awasthi</b>
            <span>Bhukkad Ghumakkad · Lucknow food &amp; travel journalist</span>
          </div>

          <p>
            Namaste Akanksha. Thank you for saying yes. Here is everything in
            one place, so you can see exactly what Bada Mangal is and how easy
            this will be. No jargon, no pressure.
          </p>

          <h2>What Bada Mangal is</h2>
          <p>
            Every Bada Mangal Tuesday, hundreds of bhandaras serve free food
            across Lucknow, but nothing told you where they were happening right
            now. So our community built it. Walkers send a photo and a location,
            and within seconds it appears on one live map for the whole city to
            use, and to reach.
          </p>

          <div className="stats">
            <div className="stat"><div className="num">600+</div><div className="lab">Bhandaras mapped</div></div>
            <div className="stat"><div className="num">60+</div><div className="lab">Areas covered</div></div>
            <div className="stat"><div className="num">9,000+</div><div className="lab">Community members</div></div>
            <div className="stat"><div className="num">Live</div><div className="lab">On web · App coming soon</div></div>
          </div>

          <h2>Why you</h2>
          <p>
            This sits exactly where your work lives. It is a food story
            (hundreds of kitchens feeding a whole city) and a human story (a
            community quietly caring for its own). As a Lucknow food journalist,
            your voice can carry it further and warmer than any advertisement
            ever could.
          </p>

          <h2>The collaboration, pick whatever suits you</h2>
          <div className="twocol">
            <div className="opt">
              <h3>Option A · The quick share</h3>
              <span className="mins">about 2 minutes</span>
              <p>
                We hand you a ready 30 second reel, a graphic, and a caption.
                You post on the next Bada Mangal Tuesday, tag the page, and keep
                the link in your story or bio.
              </p>
            </div>
            <div className="opt">
              <h3>Option B · The story (our favourite)</h3>
              <span className="mins">on the ground</span>
              <p>
                You visit a live bhandara and tell its story in your own voice.
                We send you the exact spots serving that day, so you walk
                straight to the bhog and the crowd.
              </p>
            </div>
          </div>

          <h2>What we provide</h2>
          <ul>
            <li>A 30 second screen recording of the live map in action.</li>
            <li>A reel cut and a ready graphic in the Bada Mangal theme.</li>
            <li>Captions in Hindi and English, yours to rewrite in your voice.</li>
            <li>A live list of bhandaras serving on the day, if you choose Option B.</li>
          </ul>

          <div className="ask">
            <h2>The one ask</h2>
            <p style={{ marginBottom: 0 }}>
              One reel or story on a <strong>Bada Mangal Tuesday</strong> (peak
              relevance), tagging <strong>@bada.mangal</strong> and pointing
              people to <strong>badamangal.com</strong>. That single post helps
              someone three streets away find a hot meal.
            </p>
          </div>

          <div className="note">
            <h2>A note on this collaboration</h2>
            <p>
              Bada Mangal is a non-profit, community effort with no ads and no
              commercial backing, so this is a{" "}
              <strong>goodwill collaboration, with no payment involved</strong>.
              We want to be upfront and respectful about that from the start.
            </p>
            <p>
              What we offer instead is genuine: full creative freedom, a
              permanent mention as a <strong>founding creator</strong> of the
              platform, a ready-to-use kit so it costs you almost no time, and
              the simple joy of being part of something that feeds people. If
              this ever grows into something with a budget, the people who showed
              up first will always come first.
            </p>
          </div>
        </div>

        <div className="footer">
          <span className="sign">Prateek · Founder, Bada Mangal</span>
          <span>badamangal.com · namaste@badamangal.com</span>
          <span className="made">Made with love in Lucknow</span>
        </div>
      </div>
    </div>
  );
}
