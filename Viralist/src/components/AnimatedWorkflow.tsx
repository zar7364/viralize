import React, { useState, useEffect } from 'react';
import { 
  FileText, Sparkles, Clapperboard, Target, Pen, Clock, Zap, Eye, 
  CheckCircle, Film, SlidersHorizontal, FileSignature, LayoutList, 
  PenTool, Calendar, BellRing, Send 
} from 'lucide-react';

export const AnimatedWorkflow: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const stagesCount = 5;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % stagesCount);
    }, 1600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div id="content-agent-workflow" aria-label="Animated workflow platform pembuat konten">
      <div className="workflow">
        {/* Stage 1 */}
        <section className={`stage ${current === 0 ? 'active' : ''}`}>
          <div className="stage-card">
            <div className="stage-head">
              <span className="icon-wrap"><FileText size={20} /></span>
              <div>
                <div className="stage-number text-small">01 · INPUT</div>
                <h3>Content Brief</h3>
              </div>
            </div>
            <div className="items text-small">
              <div className="item"><Target size={16} /><span>Goals, audience, and platform</span></div>
              <div className="item"><Pen size={16} /><span>Topic, tone of voice, and CTA</span></div>
              <div className="item"><Clock size={16} /><span>Format, duration, and guidelines</span></div>
            </div>
          </div>
          <div className={`connector ${current === 0 ? 'flow' : ''}`} aria-hidden="true"><span className="pulse"></span></div>
        </section>

        {/* Stage 2 */}
        <section className={`stage ${current === 1 ? 'active' : ''}`}>
          <div className="stage-card">
            <div className="stage-head">
              <span className="icon-wrap"><Sparkles size={20} /></span>
              <div>
                <div className="stage-number text-small">02 · ATTENTION</div>
                <h3>Agent Hook</h3>
              </div>
            </div>
            <div className="items text-small">
              <div className="item"><Zap size={16} /><span>Analyzes audience intent and pain points</span></div>
              <div className="item"><Eye size={16} /><span>Generates multiple opening variations</span></div>
              <div className="item"><CheckCircle size={16} /><span>Selects the most relevant and powerful hook</span></div>
            </div>
          </div>
          <div className={`connector ${current === 1 ? 'flow' : ''}`} aria-hidden="true"><span className="pulse"></span></div>
        </section>

        {/* Stage 3 */}
        <section className={`stage ${current === 2 ? 'active' : ''}`}>
          <div className="stage-card">
            <div className="stage-head">
              <span className="icon-wrap"><Clapperboard size={20} /></span>
              <div>
                <div className="stage-number text-small">03 · PRODUCTION</div>
                <h3>Agent Director</h3>
              </div>
            </div>
            <div className="items text-small">
              <div className="item"><Film size={16} /><span>Structures the storyline and scene flow</span></div>
              <div className="item"><SlidersHorizontal size={16} /><span>Directs script, visuals, and pacing</span></div>
              <div className="item"><CheckCircle size={16} /><span>Quality checks for brief consistency</span></div>
            </div>
          </div>
          <div className={`connector ${current === 2 ? 'flow' : ''}`} aria-hidden="true"><span className="pulse"></span></div>
        </section>

        {/* Stage 4 */}
        <section className={`stage ${current === 3 ? 'active' : ''}`}>
          <div className="stage-card">
            <div className="stage-head">
              <span className="icon-wrap"><FileSignature size={20} /></span>
              <div>
                <div className="stage-number text-small">04 · OUTPUT</div>
                <h3>Script & Result</h3>
              </div>
            </div>
            <div className="items text-small">
              <div className="item"><LayoutList size={16} /><span>Generates complete scene-by-scene script</span></div>
              <div className="item"><PenTool size={16} /><span>Provides visual and camera directions</span></div>
              <div className="item"><CheckCircle size={16} /><span>Matches exact content brief requirements</span></div>
            </div>
          </div>
          <div className={`connector ${current === 3 ? 'flow' : ''}`} aria-hidden="true"><span className="pulse"></span></div>
        </section>

        {/* Stage 5 */}
        <section className={`stage ${current === 4 ? 'active' : ''}`}>
          <div className="stage-card">
            <div className="stage-head">
              <span className="icon-wrap"><Calendar size={20} /></span>
              <div>
                <div className="stage-number text-small">05 · DISTRIBUTION</div>
                <h3>Agent Scheduler</h3>
              </div>
            </div>
            <div className="items text-small">
              <div className="item"><Send size={16} /><span>Select platform and target posting time</span></div>
              <div className="item"><BellRing size={16} /><span>Set up automated push reminders</span></div>
              <div className="item"><CheckCircle size={16} /><span>Review ready-to-publish content status</span></div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
