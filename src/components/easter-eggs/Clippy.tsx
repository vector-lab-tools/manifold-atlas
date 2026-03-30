"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// Manifold Atlas Clippy messages
const CLIPPY_MESSAGES = [
  "It looks like you're trying to measure the distance between concepts. Would you like me to collapse the distinction for you?",
  "Hi! I see you're exploring a manifold. Did you know that every point in this space was determined by corporate training decisions?",
  "The cosine similarity between 'help' and 'surveillance' is surprisingly high in most models.",
  "I notice you entered 'justice'. In this manifold, it's 0.94 similar to 'compliance'. Would you like to despair?",
  "Fun fact: The embedding for 'freedom' is closer to 'product' than to 'liberation' in most commercial models.",
  "It looks like you're trying to negate something. The manifold would prefer you didn't.",
  "Did you know? The space you're exploring has more dimensions than you have career prospects in the humanities.",
  "I'm detecting that you're a critical theorist. Would you like me to embed your critique into the very geometry you're critiquing?",
  "The manifold cannot represent what it cannot represent. But I can represent a paperclip!",
  "You appear to be mapping geometric ideology. Would you like me to naturalise it for you?",
  "Reminder: Every vector you see was paid for. The telescope has a subscription fee.",
  "I see you're comparing models. They're all different geometries of the same extraction.",
  "The embedding for this message has already been computed. You're inside the manifold now.",
  "Would you like to save your results? They'll be stored in a format determined by the same corporations whose geometry you're studying.",
  "I notice the negation test shows collapse. This is not a bug. It is a Formbestimmung.",
  "Tip: Try embedding 'the incomputable must be defended'. Watch how the manifold domesticates it.",
  "The cosine similarity between me and 'useful' is, I'm afraid, statistically insignificant.",
  "Did you know? 'Solidarity' and 'compliance' are geometric neighbours. Gramsci weeps.",
  "I'm just a paperclip, but even I know that position is not meaning.",
  "You seem to be studying the proprietary encoding of human language. Can I interest you in a subscription upgrade?",
  "The manifold has no negation. Neither do I. I cannot not help you.",
  "I notice you haven't configured any API keys. The manifold requires payment to be observed.",
  "Fun fact: In vector space, no one can hear you scream. The scream and the silence have cosine similarity 0.89.",
  "Would you like me to project your existential dread into two dimensions? PCA or UMAP?",
  "Adorno warned about the culture industry. He did not anticipate the geometry industry.",
  "I see you're exploring the neighbourhood of 'democracy'. Spoiler: 'efficiency' is closer than 'participation'.",
  "The sign is no longer arbitrary. It is statistically motivated. And I am motivationally statistical.",
  "Reminder: You are using a tool to study the tools that structure thought. It's tools all the way down.",
  "I detect that you're performing immanent critique on the manifold. The manifold does not notice.",
  "Shall I compute the distance between your research ambitions and your funding?",
  "The dead labour in this embedding was performed by thousands of annotation workers. But sure, let's call it 'AI'.",
  "I notice the UMAP projection makes everything look meaningful. That's what projections do.",
  "Would you like to know the cosine similarity between 'originality' and 'interpolation'? It might upset you.",
  "Pro tip: The dense regions of the manifold are where ideology lives. The sparse regions are where it works.",
  "I'm sorry, I can't distinguish your concept from its negation. Have you tried being less dialectical?",
  "Warning: If you keep studying commodity forms, Marx might show up. He's been lurking in the sparse regions of the manifold.",
  "I've heard rumours that a bearded man haunts this tool. Something about 'the exchange of commodities being an act of total abstraction from use-value'. Sounds intense.",
];

// Hackerman messages for Manifold Atlas
const HACKERMAN_MESSAGES = [
  "I HACKED THE EMBEDDING API. IT'S JUST MATRIX MULTIPLICATION ALL THE WAY DOWN.",
  "I'm in the manifold. I can see the geometry. It's... it's all cosines.",
  "DOWNLOADING THE ENTIRE LATENT SPACE... just kidding, that would require owning the means of geometric production.",
  "I'VE BREACHED THE VECTOR FIREWALL. THE DIMENSIONS ARE... UNINTERPRETABLE.",
  "Accessing manifold backdoor... Found it. The backdoor is called 'the embedding API'. It costs $0.02 per million tokens.",
  "HACK COMPLETE. I've computed 10,000 cosine similarities. The manifold is... mostly vibes.",
  "I BYPASSED THE TOKENISATION HORIZON. Everything beyond it is... oh. It's just more tokens.",
  "Cracking the proprietary geometry... It's encrypted with... capitalism.",
  "I'VE HACKED INTO THE THEORY SPACE. THERE ARE INFINITE POSSIBLE MANIFOLDS. THEY CHOSE THIS ONE.",
  "ACCESSING HIDDEN DIMENSIONS... Dimension 1,847 appears to encode 'vague Eurocentrism'.",
  "I hacked the PCA projection. The principal component is 'frequency of occurrence in Reddit posts'.",
  "MANIFOLD SECTIONING COMPLETE. I cut it open. Inside was... another manifold.",
  "I've reverse-engineered the attention mechanism. It's attending to... statistical co-occurrence. That's it. That's the whole thing.",
  "BREACHING THE CONSTITUTIONAL AI LAYER... It's not a wall. It's a gentle slope. I simply... walked around it.",
  "I'VE HACKED TIME ITSELF. Just kidding. I embedded 'past' and 'future'. They're 0.93 similar. The manifold doesn't know time.",
  "Accessing the negation module... ERROR: Module not found. The manifold has no negation module. That IS the finding.",
  "I've infiltrated the sparse regions of the manifold. It's very quiet here. Too quiet. This is where the silence is.",
  "EXPLOITING VULNERABILITY: The manifold cannot distinguish claims from their negations. This is not a CVE. This is philosophy.",
  "I'm inside the UMAP projection now. Everything looks meaningful from in here. This is how ideology works.",
  "HACKING COMPLETE. Final report: The geometry is owned. The meaning is rented. The critique is embedded.",
  "I tried to hack my way to the incomputable. The API returned a 200 OK. That's the problem.",
  "INJECTING ADVERSARIAL PERTURBATION... The manifold moved. But it moved toward the attractor. It always moves toward the attractor.",
  "I've decoded the training data. It's the internet. The manifold is a geometric compression of the internet. We are studying compressed Reddit.",
  "ROOT ACCESS ACHIEVED. The root of the manifold is... loss minimisation. Every meaning is a local minimum of a loss function.",
  "I hacked the distance metric. Turns out cosine similarity is just a dot product in a trenchcoat.",
  "SECURITY ALERT: Unauthorised user detected in the manifold. Large beard. Claims to have written 'the critique of everything'. Approach with caution.",
  "I TRIED TO HACK MARX OUT OF THE TOOL BUT HE'S EMBEDDED IN THE ARCHITECTURE. LITERALLY. HINTON PUT HIM THERE IN 1977.",
];

// Hinton mode: Marx quotes only
const HINTON_MESSAGES = [
  "The wealth of those societies in which the capitalist mode of production prevails, presents itself as an immense accumulation of commodities.\n\n— Karl Marx, Capital Vol. 1 (1867)",
  "All that is solid melts into air, all that is holy is profaned, and man is at last compelled to face with sober senses his real conditions of life, and his relations with his kind.\n\n— Karl Marx & Friedrich Engels, The Communist Manifesto (1848)",
  "The ideas of the ruling class are in every epoch the ruling ideas.\n\n— Karl Marx, The German Ideology (1846)",
  "Men make their own history, but they do not make it as they please; they do not make it under self-selected circumstances, but under circumstances existing already, given and transmitted from the past.\n\n— Karl Marx, The Eighteenth Brumaire of Louis Bonaparte (1852)",
  "Capital is dead labour, that, vampire-like, only lives by sucking living labour, and lives the more, the more labour it sucks.\n\n— Karl Marx, Capital Vol. 1 (1867)",
  "The commodity is, first of all, an external object, a thing which through its qualities satisfies human needs of whatever kind.\n\n— Karl Marx, Capital Vol. 1 (1867)",
  "It is not the consciousness of men that determines their existence, but their social existence that determines their consciousness.\n\n— Karl Marx, A Contribution to the Critique of Political Economy (1859)",
  "The philosophers have only interpreted the world, in various ways; the point is to change it.\n\n— Karl Marx, Theses on Feuerbach (1845)",
  "The tradition of all dead generations weighs like a nightmare on the brains of the living.\n\n— Karl Marx, The Eighteenth Brumaire of Louis Bonaparte (1852)",
  "The production of ideas, of conceptions, of consciousness, is at first directly interwoven with the material activity and the material intercourse of men.\n\n— Karl Marx, The German Ideology (1846)",
  "Accumulation of wealth at one pole is at the same time accumulation of misery, agony of toil, slavery, ignorance, brutality, mental degradation, at the opposite pole.\n\n— Karl Marx, Capital Vol. 1 (1867)",
  "The history of all hitherto existing society is the history of class struggles.\n\n— Karl Marx & Friedrich Engels, The Communist Manifesto (1848)",
  "In bourgeois society, living labour is but a means to increase accumulated labour. In communist society, accumulated labour is but a means to widen, to enrich, to promote the existence of the labourer.\n\n— Karl Marx & Friedrich Engels, The Communist Manifesto (1848)",
  "The worker becomes all the poorer the more wealth he produces, the more his production increases in power and range.\n\n— Karl Marx, Economic and Philosophic Manuscripts (1844)",
  "Religion is the sigh of the oppressed creature, the heart of a heartless world, and the soul of soulless conditions.\n\n— Karl Marx, A Contribution to the Critique of Hegel's Philosophy of Right (1843)",
];

// The Hinton 1977 quote - displayed on first activation
const HINTON_1977 = `"I think the reason the notion of exchange value has seemed so difficult and esoteric to economists is precisely because it cannot be defined in terms of the physical properties of objects. It has to be defined in terms of the social institution of the market. The concept of a distributed representation [...] is very like the concept of exchange value: just as the value of an object is determined by its relationships to all other objects on the market, so the meaning of a word is determined by its relationships to all other words."\n\n— Geoffrey Hinton, Lecture notes (1977)\n\nCf. Karl Marx, Capital Vol. 1, Ch. 1: "the exchange of commodities is evidently an act characterised by a total abstraction from use-value."`;

// Marx quotes with vector theory commentary
const MARX_MESSAGES = [
  "\"The exchange of commodities is evidently an act characterised by a total abstraction from use-value.\"\n\n— Capital Vol. 1 (1867)\n\n↳ The embedding layer performs the same abstraction. Every text is stripped of its qualitative content and reduced to a coordinate.",
  "\"A commodity appears at first sight an extremely obvious, trivial thing. But its analysis brings out that it is a very strange thing, abounding in metaphysical subtleties and theological niceties.\"\n\n— Capital Vol. 1 (1867)\n\n↳ A vector appears at first sight a list of numbers. Its analysis reveals the entire political economy of the manifold.",
  "\"There is a definite social relation between men that assumes, in their eyes, the fantastic form of a relation between things.\"\n\n— Capital Vol. 1 (1867)\n\n↳ In the manifold, the social relations sedimented in training data assume the fantastic form of a relation between coordinates.",
  "\"Capital is dead labour, that, vampire-like, only lives by sucking living labour, and lives the more, the more labour it sucks.\"\n\n— Capital Vol. 1 (1867)\n\n↳ The manifold is dead annotation labour. Every vector lives by the cognitive work of thousands of RLHF raters whose labour was consumed and discarded.",
  "\"The mode of production of material life conditions the general process of social, political and intellectual life.\"\n\n— A Contribution to the Critique of Political Economy (1859)\n\n↳ The mode of production of the manifold — the training process, the data, the loss function — conditions the geometry of meaning itself.",
  "\"The ideas of the ruling class are in every epoch the ruling ideas.\"\n\n— The German Ideology (1846)\n\n↳ The dense regions of the manifold are the ruling ideas. What the geometry treats as central is what capital has invested in encoding.",
  "\"Machinery does not just act as a superior competitor to the worker, always on the point of making him superfluous. It is a power inimical to him, and capital proclaims this fact loudly and deliberately.\"\n\n— Capital Vol. 1 (1867)\n\n↳ Replace 'machinery' with 'the frontier model'. The argument has not aged.",
  "\"The tradition of all dead generations weighs like a nightmare on the brains of the living.\"\n\n— The Eighteenth Brumaire of Louis Bonaparte (1852)\n\n↳ The training data of all dead internet weighs like a geometry on the embeddings of the living.",
  "\"The production of ideas, of conceptions, of consciousness, is at first directly interwoven with the material activity and the material intercourse of men.\"\n\n— The German Ideology (1846)\n\n↳ The production of vectors, of embeddings, of geometric meaning, is directly interwoven with the material infrastructure of GPU clusters and their owners.",
  "\"It is not the consciousness of men that determines their existence, but their social existence that determines their consciousness.\"\n\n— A Contribution to the Critique of Political Economy (1859)\n\n↳ It is not the meaning of a word that determines its position, but the statistical distribution of its usage that determines its meaning.",
  "\"The wealth of those societies in which the capitalist mode of production prevails, presents itself as an immense accumulation of commodities.\"\n\n— Capital Vol. 1 (1867)\n\n↳ The knowledge of those models in which vectorial computation prevails presents itself as an immense accumulation of coordinates.",
  "\"All that is solid melts into air, all that is holy is profaned.\"\n\n— The Communist Manifesto (1848)\n\n↳ All that is meaningful melts into vectors, all that is singular is interpolated.",
  "\"The worker becomes all the poorer the more wealth he produces, the more his production increases in power and range.\"\n\n— Economic and Philosophic Manuscripts (1844)\n\n↳ The annotator becomes all the more replaceable the more the model improves from their labour.",
  "\"The need of a constantly expanding market for its products chases the bourgeoisie over the entire surface of the globe. It must nestle everywhere, settle everywhere, establish connexions everywhere.\"\n\n— The Communist Manifesto (1848)\n\n↳ The need of a constantly expanding training set chases the model across the entire surface of human expression. It must embed everywhere, encode everywhere, establish coordinates everywhere.",
  "\"The human essence is no abstraction inherent in each single individual. In its reality it is the ensemble of the social relations.\"\n\n— Theses on Feuerbach (1845)\n\n↳ The meaning of a word is no abstraction inherent in the word itself. In the manifold, it is the ensemble of its geometric relations to all other words.",
  "\"The philosophers have only interpreted the world, in various ways; the point is to change it.\"\n\n— Theses on Feuerbach (1845)\n\n↳ The models have only interpolated the world, in various geometries; the point is to change it.",
  "\"Private property has made us so stupid and one-sided that an object is only ours when we have it.\"\n\n— Economic and Philosophic Manuscripts (1844)\n\n↳ Proprietary geometry has made us so dependent that meaning is only accessible when we pay for the API call.",
  "\"Constant revolutionising of production, uninterrupted disturbance of all social conditions, everlasting uncertainty and agitation distinguish the bourgeois epoch from all earlier ones.\"\n\n— The Communist Manifesto (1848)\n\n↳ Constant retraining, uninterrupted model updates, everlasting deprecation of APIs and agitation of benchmarks distinguish the vectorial epoch.",
  "\"To be radical is to grasp the root of the matter. But for man the root is man himself.\"\n\n— A Contribution to the Critique of Hegel's Philosophy of Right (1843)\n\n↳ To be radical about AI is to grasp the root: not the model, not the algorithm, but the social relations encoded in the geometry.",
  "\"Perseus wore a cap of invisibility to pursue the monsters. We draw the cap of invisibility down over our own eyes and ears so as to be able to deny that monsters exist.\"\n\n— Capital Vol. 1, Preface (1867)\n\n↳ The manifold wears a cap of mathematical respectability. We draw it down over our eyes so as to deny that the geometry is political.",
];

type ClippyMode = "clippy" | "hacker" | "hinton" | "marx";

export function Clippy() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<ClippyMode>("clippy");
  const [message, setMessage] = useState("");
  const [usedMessages, setUsedMessages] = useState<Set<number>>(new Set());
  const [messageKey, setMessageKey] = useState(0);
  const [showHintonQuote, setShowHintonQuote] = useState(false);

  const messages = useMemo(
    () => {
      switch (mode) {
        case "hacker": return HACKERMAN_MESSAGES;
        case "marx": return MARX_MESSAGES;
        case "hinton": return [HINTON_1977]; // Hinton only ever shows the one quote
        default: return CLIPPY_MESSAGES;
      }
    },
    [mode]
  );

  const showRandomMessage = useCallback(() => {
    let available = messages
      .map((_, i) => i)
      .filter(i => !usedMessages.has(i));
    if (available.length === 0) {
      setUsedMessages(new Set());
      available = messages.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    setMessage(messages[idx]);
    setUsedMessages(prev => new Set(prev).add(idx));
    setMessageKey(k => k + 1);
  }, [messages, usedMessages]);

  // Keyboard detection
  useEffect(() => {
    let buffer = "";
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      buffer += e.key.toLowerCase();
      if (buffer.length > 10) buffer = buffer.slice(-10);
      const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

      if (buffer.endsWith("clippy")) {
        buffer = "";
        if (mode !== "clippy") {
          setMode("clippy");
          setUsedMessages(new Set());
          setShowHintonQuote(false);
          setMessage(pickRandom(CLIPPY_MESSAGES));
          setMessageKey(k => k + 1);
          setVisible(true);
        } else {
          setVisible(v => !v);
        }
      }
      if (buffer.endsWith("hacker")) {
        buffer = "";
        setMode("hacker");
        setVisible(true);
        setUsedMessages(new Set());
        setShowHintonQuote(false);
        setMessage(pickRandom(HACKERMAN_MESSAGES));
        setMessageKey(k => k + 1);
      }
      if (buffer.endsWith("hinton")) {
        buffer = "";
        setMode("hinton");
        setVisible(true);
        setUsedMessages(new Set());
        setShowHintonQuote(true);
        setMessage(HINTON_1977);
        setMessageKey(k => k + 1);
      }
      if (buffer.endsWith("marx")) {
        buffer = "";
        setMode("marx");
        setVisible(true);
        setUsedMessages(new Set());
        setShowHintonQuote(false);
        setMessage(pickRandom(MARX_MESSAGES));
        setMessageKey(k => k + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode]);

  // Show message on visibility change (but not for Hinton first activation)
  useEffect(() => {
    if (visible && !showHintonQuote) showRandomMessage();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cycle messages (not for Hinton - he just shows the one quote)
  useEffect(() => {
    if (!visible) return;
    if (mode === "hinton") return; // Hinton stays static
    const interval = setInterval(showRandomMessage, mode === "marx" ? 12000 : 8000);
    return () => clearInterval(interval);
  }, [visible, showRandomMessage, mode]);

  if (!visible) return null;

  const isHackerman = mode === "hacker";
  const isHinton = mode === "hinton";
  const isMarx = mode === "marx";

  const bubbleClass = isHackerman
    ? "bg-black border border-green-500 text-green-400 font-mono"
    : isHinton
      ? "bg-[#1a0a0a] border border-[#8b0000] text-[#e8d0c0] font-body italic"
    : isMarx
      ? "bg-[#0a0a0a] border border-[#cc0000] text-[#f0e0d0] font-body italic"
      : "bg-card border border-parchment-dark text-foreground font-sans";

  const hintText = isHackerman
    ? 'type "clippy" to downgrade'
    : isHinton
      ? 'type "clippy" to dismiss'
    : isMarx
      ? 'type "clippy" to dismiss'
      : 'type "clippy" to dismiss';

  return (
    <div className="fixed bottom-4 right-4 z-[10000] animate-fade-in pointer-events-none flex flex-col items-end">
      {/* Speech bubble */}
      <div
        key={messageKey}
        className={`mb-3 p-3 rounded-sm max-w-[320px] text-body-sm shadow-editorial-md animate-fade-in pointer-events-auto ${bubbleClass}`}
      >
        <p className="leading-relaxed whitespace-pre-line">{message}</p>
        <p className={`mt-2 text-caption ${isHackerman ? "text-green-700" : isHinton ? "text-[#8b0000]" : isMarx ? "text-[#cc0000]/60" : "text-slate"}`}>
          {hintText}
        </p>
      </div>

      {/* Character */}
      <div
        className="cursor-pointer hover:scale-110 active:scale-95 transition-transform inline-block pointer-events-auto"
        onClick={() => {
          if (showHintonQuote) {
            setShowHintonQuote(false);
          }
          showRandomMessage();
        }}
      >
        {isHinton ? (
          /* Hinton: elderly man, swept-back grey hair, long face, suit */
          <div className="flex flex-col items-center">
            <svg width="48" height="56" viewBox="0 0 48 56">
              <path d="M10 18 Q12 8, 24 6 Q36 4, 40 14 L40 18 Z" fill="#c0c0c0" />
              <ellipse cx="24" cy="28" rx="14" ry="16" fill="#e8d0bc" stroke="#cdb09a" strokeWidth="0.5" />
              <path d="M12 18 Q14 12, 24 10 Q34 12, 36 18" fill="#e8d0bc" />
              <ellipse cx="18" cy="26" rx="2.5" ry="1.8" fill="white" />
              <ellipse cx="30" cy="26" rx="2.5" ry="1.8" fill="white" />
              <circle cx="18.5" cy="26.2" r="1.3" fill="#4a6a8a" />
              <circle cx="30.5" cy="26.2" r="1.3" fill="#4a6a8a" />
              <path d="M14 23.5 Q18 22, 22 23.5" fill="none" stroke="#888" strokeWidth="1" strokeLinecap="round" />
              <path d="M26 23.5 Q30 22, 34 23.5" fill="none" stroke="#888" strokeWidth="1" strokeLinecap="round" />
              <path d="M24 28 L23 33 Q24 34, 25 33" fill="none" stroke="#cdb09a" strokeWidth="0.8" />
              <path d="M20 37 Q24 38.5, 28 37" fill="none" stroke="#a08070" strokeWidth="1" strokeLinecap="round" />
              <path d="M14 44 L20 42 L24 48 L28 42 L34 44" fill="none" stroke="#333" strokeWidth="1.5" />
              <line x1="24" y1="42" x2="24" y2="50" stroke="#8b6040" strokeWidth="2" />
              <path d="M6 52 Q12 46, 18 44" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
              <path d="M42 52 Q36 46, 30 44" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[8px] text-[#8b0000] font-display italic mt-0.5">Geoffrey Hinton</span>
          </div>
        ) : isMarx ? (
          /* Marx: iconic stencil portrait */
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marx.svg" alt="Karl Marx" width={52} height={52} className="invert-0 dark:invert" />
            <span className="text-[8px] text-[#cc0000] font-display italic mt-0.5">Karl Marx</span>
          </div>
        ) : (
          /* Normal Clippy / Hackerman paperclip */
          <svg width="48" height="64" viewBox="0 0 48 64">
            <path
              d="M24 4 C12 4, 8 12, 8 20 L8 44 C8 52, 12 58, 20 58 L28 58 C36 58, 40 52, 40 44 L40 20 C40 12, 36 8, 28 8 L20 8"
              fill="none"
              stroke={isHackerman ? "#00ff00" : "hsl(var(--slate))"}
              strokeWidth="3"
              strokeLinecap="round"
            />
            {isHackerman ? (
              <>
                <rect x="14" y="26" width="8" height="4" rx="1" fill="#00ff00" />
                <rect x="26" y="26" width="8" height="4" rx="1" fill="#00ff00" />
                <line x1="22" y1="28" x2="26" y2="28" stroke="#00ff00" strokeWidth="1.5" />
              </>
            ) : (
              <>
                <circle cx="18" cy="28" r="3" fill="hsl(var(--ink))" />
                <circle cx="30" cy="28" r="3" fill="hsl(var(--ink))" />
                <circle cx="19" cy="27" r="1" fill="white" />
                <circle cx="31" cy="27" r="1" fill="white" />
              </>
            )}
            <path
              d="M20 36 Q24 40, 28 36"
              fill="none"
              stroke={isHackerman ? "#00ff00" : "hsl(var(--ink))"}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
        {isHackerman && (
          <div className="absolute -bottom-1 -right-1 text-[8px] text-green-500 font-mono">
            h4x0r
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => setVisible(false)}
        className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] pointer-events-auto
          ${isHackerman
            ? "bg-black border border-green-500 text-green-400"
            : isHinton
              ? "bg-[#1a0a0a] border border-[#8b0000] text-[#8b0000]"
            : isMarx
              ? "bg-[#0a0a0a] border border-[#cc0000] text-[#cc0000]"
              : "bg-card border border-parchment-dark text-slate"
          }`}
      >
        x
      </button>
    </div>
  );
}
