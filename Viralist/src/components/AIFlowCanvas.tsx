import React, { useEffect, useRef, useState } from 'react';
import {
  Webhook, BrainCircuit, Cpu, Sparkles,
  Clapperboard, Workflow, FileText, ScanSearch, GitBranch,
  CheckCircle, CalendarClock, Brackets, Binary, Network, Database,
  Loader2, Send
} from 'lucide-react';

const order = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
const wireFor = ["w0","w1","w2","w3","w4","w5","w6","w7","w8","w9","w10","w11","w12","w13"];
export const AIFlowCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const packetRef = useRef<SVGCircleElement>(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const idxRef = useRef(0);
  const pausedRef = useRef(false);
  const isRunningRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Sync state to refs for interval
  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const move = (pathId: string) => {
    if (!containerRef.current || !packetRef.current) return;
    const path = containerRef.current.querySelector(`#${pathId}`) as SVGPathElement;
    if (!path) return;

    const len = path.getTotalLength();
    let start: number | null = null;
    path.classList.add("hot");

    const frame = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / 650, 1);
      const pt = path.getPointAtLength(len * p);
      if (packetRef.current) {
        packetRef.current.setAttribute("cx", String(pt.x));
        packetRef.current.setAttribute("cy", String(pt.y));
      }
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        path.classList.remove("hot");
      }
    };
    requestAnimationFrame(frame);
  };

  const tick = () => {
    if (pausedRef.current || idxRef.current >= order.length) return;
    
    if (idxRef.current < wireFor.length) {
      move(wireFor[idxRef.current]);
    }
    
    setIdx(prev => prev + 1);
  };

  const run = () => {
    if (idxRef.current >= order.length) {
      setIdx(0);
    }
    setPaused(false);
    setIsRunning(true);
    
    if (!timerRef.current) {
      timerRef.current = window.setInterval(tick, 1150);
    }
  };

  useEffect(() => {
    if (idx >= order.length) {
      setTimeout(() => {
        setIdx(0);
        if (packetRef.current) {
          packetRef.current.setAttribute("cx", "-20");
        }
        if (containerRef.current) {
          containerRef.current.querySelectorAll(".wire").forEach(w => w.classList.remove("hot"));
        }
      }, 2000); // 2 second pause before restarting loop
    }
  }, [idx]);

  // Auto-run on mount
  useEffect(() => {
    const t = setTimeout(() => {
      run();
    }, 500);
    return () => {
      clearTimeout(t);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateText = idx >= order.length ? "Campaign scheduled" : (paused ? "Workflow paused" : (isRunning ? "AI processing" : "Ready to execute"));

  const getNodeClass = (step: number) => {
    const pos = order.indexOf(step);
    if (pos < idx) return "node done";
    if (pos === idx && idx < order.length) return "node active";
    return "node";
  };

  return (
    <div style={{ marginTop: '4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>How does our backend work?</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Behind the scenes of Viralize's non-linear AI processing</p>
      </div>
      <div id="ai-flow-canvas" className={isRunning ? 'is-running' : ''} aria-label="Non-linear animated AI content workflow" ref={containerRef}>
      <div className="bar">
        <div className="state">
          <span className="state-dot"></span>
          <div>
            <div id="af-state" style={{ fontWeight: 600 }}>{stateText}</div>
            <div className="text-small text-muted" id="af-count" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {Math.min(idx, order.length)} / {order.length} processes
            </div>
          </div>
        </div>
      </div>

      <div className="board" id="af-board">
        <svg className="wires" viewBox="0 0 1000 680" preserveAspectRatio="none" aria-hidden="true">
          <path className="wire" id="w0" d="M185 70 C220 70 240 70 280 70" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w1" d="M435 70 C475 70 505 70 550 70" vectorEffect="non-scaling-stroke"/>
          <path className="wire support" id="w2" d="M625 120 C620 175 390 185 390 286" vectorEffect="non-scaling-stroke"/>
          <path className="wire support" id="w3" d="M625 120 C625 190 515 205 515 286" vectorEffect="non-scaling-stroke"/>
          <path className="wire support" id="w4" d="M625 120 C625 190 635 205 635 286" vectorEffect="non-scaling-stroke"/>
          <path className="wire support" id="w5" d="M625 120 C630 175 755 190 755 286" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w6" d="M705 70 C745 70 770 70 800 70" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w7" d="M875 120 C875 220 875 300 875 400" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w8" d="M800 400 C750 400 730 400 700 400" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w9" d="M550 400 C510 400 490 400 450 400" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w10" d="M340 400 C300 400 275 400 230 400" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w11" d="M145 450 C145 500 145 545 145 604" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w12" d="M225 604 C270 604 300 604 340 604" vectorEffect="non-scaling-stroke"/>
          <path className="wire" id="w13" d="M495 604 C535 604 565 604 610 604" vectorEffect="non-scaling-stroke"/>
          <circle className="packet" id="af-packet" r="6" cx="-20" cy="-20" ref={packetRef} />
        </svg>

        <div className={getNodeClass(0)} data-step="0" style={{left: '3%', top: '3%'}}>
          <span className="port out"></span>
          <div className="nh">
            <div className="nt"><Webhook size={16} /><span>Content Brief</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Trigger · audience, topic, CTA</p>
        </div>
        <div className={getNodeClass(1)} data-step="1" style={{left: '28%', top: '3%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><BrainCircuit size={16} /><span>Brief Intelligence</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Intent, entity and tone analysis</p>
        </div>
        <div className={getNodeClass(2)} data-step="2" style={{left: '55%', top: '3%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><Cpu size={16} /><span>Transformer Engine</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Contextual processing</p>
        </div>
        <div className={getNodeClass(7)} data-step="7" style={{left: '80%', top: '3%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><Sparkles size={16} /><span>Agent Hook</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Generate and rank 10 hooks</p>
        </div>
        <div className={getNodeClass(8)} data-step="8" style={{left: '80%', top: '51%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><Clapperboard size={16} /><span>Agent Director</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Story, scene, camera and pacing</p>
        </div>
        <div className={getNodeClass(9)} data-step="9" style={{left: '55%', top: '51%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><Workflow size={16} /><span>Decoder</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Generate output token by token</p>
        </div>
        <div className={getNodeClass(10)} data-step="10" style={{left: '30%', top: '51%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><FileText size={16} /><span>Viral Script</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Voice-over, visuals and CTA</p>
        </div>
        <div className={getNodeClass(11)} data-step="11" style={{left: '7%', top: '51%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><ScanSearch size={16} /><span>AI Evaluators</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Quality, relevance and brand fit</p>
        </div>
        <div className={getNodeClass(12) + " decision"} data-step="12" style={{left: '7%', top: '81%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="inner">
            <div className="nt"><GitBranch size={16} /><span>Quality Decision</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Score validation</p>
        </div>
        <div className={getNodeClass(13)} data-step="13" style={{left: '34%', top: '81%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><CheckCircle size={16} /><span>Human Approval</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Approve or revise campaign</p>
        </div>
        <div className={getNodeClass(14)} data-step="14" style={{left: '61%', top: '81%'}}>
          <span className="port in"></span><span className="port out"></span>
          <div className="nh">
            <div className="nt"><CalendarClock size={16} /><span>Agent Scheduler</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
          <p className="desc">Queue approved social content</p>
        </div>

        {/* Support nodes */}
        <div className={getNodeClass(3) + " support-node"} data-step="3" style={{left: '34%', top: '34%'}}>
          <div className="nh">
            <div className="nt"><Brackets size={16} /><span>Tokenizer</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
        </div>
        <div className={getNodeClass(4) + " support-node"} data-step="4" style={{left: '46%', top: '34%'}}>
          <div className="nh">
            <div className="nt"><Binary size={16} /><span>Embedding</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
        </div>
        <div className={getNodeClass(5) + " support-node"} data-step="5" style={{left: '58%', top: '34%'}}>
          <div className="nh">
            <div className="nt"><Network size={16} /><span>Attention</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
        </div>
        <div className={getNodeClass(6) + " support-node"} data-step="6" style={{left: '70%', top: '34%'}}>
          <div className="nh">
            <div className="nt"><Database size={16} /><span>Retrieval</span></div>
            <span className="status-icon"><Loader2 size={12} /></span>
          </div>
        </div>

        <span className="label text-small" style={{left: '51%', top: '29%'}}>AI model tools</span>
        <span className="label text-small" style={{left: '24%', top: '85%'}}>approved</span>
        <span className="label text-small" style={{left: '3%', top: '71%'}}>quality gate</span>

        {/* Final End-State Box */}
        <div className={`end-state-box ${idx >= order.length ? 'active' : ''}`} style={{left: '81%', top: '80%'}}>
          <div className="es-label">
            <Send size={14} /> <span>Content ready</span>
          </div>
          <h4 className="es-heading">Let's post your content!</h4>
          <p className="es-desc">Your content is ready to review and publish.</p>
        </div>
      </div>

      </div>
    </div>
  );
};
