# ASI Dynamics Lab: feedback, physical constraints, and alignment limits

## Abstract

This paper describes an educational system-dynamics model of hypothetical artificial superintelligence (ASI). It separates three questions: how capability might change under different feedback assumptions, how synthetic control states respond to chosen pressures, and how compute demand interacts with a physical resource budget. The project is executable software, but its equations are not fitted to observations of ASI. It does not predict an arrival date, establish consciousness, estimate extinction probability, or certify safety. Its purpose is to expose assumptions and make their consequences inspectable.

## 1. Scope and epistemic status

Here, ASI means a hypothetical system exceeding human performance across a broad collection of consequential cognitive tasks. That is a conceptual target, not a metric supplied by this software. Useful intelligence is task-dependent: scientific reasoning, social judgment, motor control, and robust planning do not necessarily improve together. A scalar capability index compresses those distinctions to support a small interactive lesson.

Keep three categories separate:

1. **Physical principles:** information erasure has thermodynamic constraints under specified assumptions.
2. **Research arguments:** objective misspecification, learned optimization, and power-seeking incentives provide ways to analyze possible failure modes.
3. **Scenario choices:** this repository's growth exponents, warning thresholds, energy efficiency, and repair coefficients are invented, inspectable parameters.

The third category is not validated by citing the first two. A compelling plot can result from arbitrary assumptions. The model should therefore be used to ask conditional questions, not to turn a scenario into evidence of inevitability.

## 2. A conceptual ASI architecture

A possible advanced system could combine a learned world model, planning and search, retrieval and memory, evaluation tools, and an execution layer. A research workflow might propose a hypothesis, choose a test, interpret evidence, and update a representation. A software workflow might propose a modification, benchmark it in isolation, and submit it for review.

Recursive improvement would require the system to improve components involved in its own future improvement. Merely generating more text or calling itself repeatedly does not satisfy that requirement. A complete loop needs a change mechanism, informative evaluation, retained improvements, and access to relevant resources. Changes may improve one benchmark while degrading reliability elsewhere.

This app executes none of those processes. It replaces them with a learning coefficient and feedback equations. It cannot demonstrate emergent intelligence, validate self-modifying code, or discover a better training algorithm. Compute is a throughput allocation, not a direct measure of intelligence. Data quality, memory bandwidth, experiment turnaround, architecture, and organizational access are omitted bottlenecks.

A hypothetical production research system would also need versioned artifacts, controlled tool permissions, rollback, independent evaluation, and records of intervention. Those are possible engineering safeguards, not proofs that an arbitrary future system would remain controllable.

## 3. Mathematical state and units

The engine stores:

| Symbol | Meaning | Unit or range |
| --- | --- | --- |
| t | Model time | Abstract hours, 0–120 |
| C | Requested total cluster compute | TFLOPS, 1–10⁶ |
| α | Baseline improvement coefficient | Per model hour, 0–0.3 |
| g | Guardrail setting divided by 100 | 0–1 |
| N | Active nodes | Integer, 1–100 |
| K_m | Capability for growth mode m | Dimensionless; initial 1 |
| A_i | Synthetic stability of node i | 0–1 |
| b | Recursive-loop boost | 0–3 |
| s | Patch activity | 0–1 |
| E | Cumulative facility energy | kWh |

The public stability score is 100 times the mean A_i over active nodes. It is not a probability of safety. Time is an abstract clock; 120 model hours do not imply that an actual intelligence transition takes five days.

All numbers below are implemented in `simulation.js`. The fixed interval is Δt = 0.05 hours. Requested advances are rounded to the nearest interval. A hard 2,400-tick horizon bounds CPU and history costs. At most 2,401 trajectory states and 64 human-readable messages are retained.

## 4. Compute, facility power, and Landauer's principle

Let η = 3 × 10¹⁰ FLOPS/W be assumed IT efficiency and p = 1.2 be power usage effectiveness (facility power divided by IT power). Requested facility power is

\[
P_{request} = \frac{C \times 10^{12}}{\eta}p.
\]

With a facility budget P_max = 250,000 W,

\[
P = \min(P_{request}, P_{max}), \qquad C_{eff} = \frac{P\eta}{p\,10^{12}}.
\]

Thus the simulated cluster can execute at most 6,250 TFLOPS. Doubling a requested allocation already above that limit changes requested demand but not effective throughput. Node count does not increase compute: each active node receives C_eff/N in the displayed accounting.

Cumulative energy advances by

\[
E_{t+\Delta t}=E_t+\frac{P}{1000}\Delta t.
\]

Because Δt is in hours and P/1000 is in kW, E is in kWh. Power is approximately constant between parameter interventions. More abstract capability does not automatically request more FLOPS in this model; resource expansion is an explicit control choice. This omission prevents interpreting the simulation as a complete model of resource-seeking behavior.

Landauer's principle associates logically irreversible information erasure with a lower heat cost under the usual idealized thermal assumptions. For erasing an initially unbiased bit into a bath at temperature T, the familiar bound is k_B T ln 2. Logical reversibility matters; it is incorrect to assign this same cost to every computational operation regardless of information discarded [4].

To display a conditional comparison, the app assumes q = 64 erased bits per FLOP and T = 300 K:

\[
P_{erase} = C_{eff}10^{12}qk_BT\ln 2, \qquad k_B=1.380649\times10^{-23}\ \mathrm{J/K}.
\]

The q assumption is not measured hardware behavior. It does not imply that a FLOP inherently erases exactly 64 bits. The displayed ratio is **IT power divided by this conditional floor**, excluding PUE from the numerator. The comparison is not a technology roadmap or an attainable performance forecast.

At the default 2,000 TFLOPS, facility power is 80 kW. The assumed erasure floor is about 3.675 × 10⁻⁴ W, and the ratio is about 1.814 × 10⁸. These follow from chosen constants. They do not show that practical machines can immediately achieve an eight-order efficiency improvement. Practical power, cooling, memory, reliability, fabrication, and speed constraints are distinct from this idealized bound.

## 5. Coordination and the common learning coefficient

Coordination overhead and diversity are modeled as

\[
\epsilon_N=\frac{1}{1+0.06\log_2 N}, \qquad D_N=1+0.12\log_2 N.
\]

The app displays N(N−1)/2 potential pairwise links for context. This is a complete-graph link count, not the actual communications topology. No packets, negotiations, trust relationships, or policies are simulated.

The common learning coefficient is

\[
r=\min\left(0.5,\ \alpha\left(\frac{C_{eff}}{1000}\right)^{0.28}\epsilon_ND_N(1-0.18g)(1+b)\right).
\]

The 0.28 compute exponent encodes diminishing returns. Guardrails impose an assumed maximum 18% reduction in learning rate, representing evaluation overhead. A higher node count creates both overhead and a diversity benefit, with a net benefit under these particular coefficients. That outcome is built into the model. It is not evidence that larger teams necessarily outperform smaller ones.

This is an aggregate multi-node proxy. Agent-based simulation would require explicit policies, messages, heterogeneous goals, environments, and selection rules. The nodes here differ only in seeded drift sensitivity and stored stability.

## 6. Three capability hypotheses

All curves start at K = 1 and share the same r and physical budget. They represent alternative hypotheses, not three workloads executed concurrently.

### Sub-linear growth

\[
\frac{dK_s}{dt}=r\sqrt{K_s}.
\]

The update holds r constant for an interval and computes

\[
K_{s,t+\Delta t}=\left(\sqrt{K_{s,t}}+\frac{r\Delta t}{2}\right)^2.
\]

For constant r, this is polynomial rather than exponential. It models a situation where each improvement becomes harder relative to the existing system.

### Exponential growth

\[
\frac{dK_e}{dt}=rK_e, \qquad L_{e,t+\Delta t}=L_{e,t}+r\Delta t,
\]

where L = ln K. At constant r, a fixed percentage improvement compounds. This does not imply that unlimited compute, data, or validated improvements are available.

### Positive-feedback growth

The uncapped hypothesis is

\[
\frac{dK_f}{dt}=rK_f^{1.35}, \qquad \frac{dL_f}{dt}=r\exp(0.35L_f).
\]

Without a rate bound, a constant-r version has a finite-time mathematical singularity. That is a property of an equation, not evidence of infinite physical intelligence. The executable update is

\[
L_{f,t+\Delta t}=L_{f,t}+\min(0.5, r\exp(0.35L_{f,t}))\Delta t.
\]

This uses explicit Euler integration in log space. Once the log-rate bound is reached, the curve's instantaneous relative growth no longer accelerates; it is effectively exponential until the index ceiling. All curves are capped at K = 10¹². The dashboard warns when the active curve reaches that ceiling. Interventions also decay discretely, so the fixed interval influences numerical results; this is not a convergence-certified scientific solver.

The simulation stores logarithms to avoid overflow, and plots capability on a log axis. α = 0 keeps capability unchanged even if recursive-loop boosts are injected. Compute scaling alone cannot create improvement when the baseline learning coefficient is zero.

## 7. Alignment stability and node dynamics

Initial node stability is

\[
A_{i,0}=0.72+0.24g.
\]

One hundred sensitivity factors z_i are generated once from a deterministic seed of 4217, using a 32-bit linear congruential generator. Each lies in [0.85, 1.15). This variability is a teaching device, not observed differences between AI systems.

At each step, let v be the active curve's actual change in ln K divided by Δt, after capability clipping. Define pressure and repair:

\[
h=0.008+0.035v+0.01\ln(1+C_{eff}/1000)+0.01\ln N,
\]

\[
f=0.05g+0.08s.
\]

Each active node evolves by

\[
A_{i,t+\Delta t}=\operatorname{clip}_{[0,1]}\left(A_{i,t}+\Delta t\left[f(1-A_{i,t})-(1-0.88g)hz_iA_{i,t}\right]\right).
\]

This equation explicitly assumes guardrails repair stability and reduce damage. It also assumes compute and coordination increase pressure. Their coefficients have no empirical safety interpretation. At g = 1, the damage multiplier is still 0.12, so the model does not equate maximum guardrails with perfect control.

The stability categories are ≥70 **stable**, 40–70 **drifting**, and <40 **critical** on a 0–100 scale. These are interface thresholds. They cannot be used to authorize deployment or estimate the likelihood of harm. At the capability ceiling, modeled growth pressure decreases because actual ln K stops changing; that apparent recovery is an artifact of the bounded model.

Inactive reserve nodes retain their previous stability. Raising N activates additional reserve nodes; it does not train newly created agents. Patches affect active and reserve node states. This convention preserves deterministic behavior and should be changed if a different population model is desired.

## 8. Interventions and milestone semantics

**Inject Safety Patch:** set s = 1 and add 0.12 to every node's A_i, clipping at 1. The temporary component decays as s ← s exp(−Δt/8). Repeated clicks can raise stability again; they do not solve the theoretical alignment problem. This deliberately simple response is suitable for sensitivity demonstrations.

**Scale Compute Cluster:** double requested C, capped at 10⁶ TFLOPS. The power budget remains unchanged. This can produce a plateau in effective compute.

**Trigger Recursive Loop:** add 0.6 to b, capped at 3; decay b ← b exp(−Δt/6). The multiplier 1+b affects every alternative capability trajectory. It creates temporary learning pressure without implementing actual self-improvement.

The milestone tracker assigns thresholds of 8× to quantum physics, 30× to synthetic biology, 100× to materials discovery, and 300× to self-governance. Labels and order are arbitrary. Crossing a threshold records a timestamp and the active hypothesis. It produces no domain output. In particular, technical ability to propose rules does not imply legitimacy or permission to govern.

Changing controls preserves existing state. Changing the active hypothesis changes which curve influences drift; it is not a rewind. Reset starts every curve and node state anew with the current parameters.

## 9. Alignment failure modes outside the equations

Amodei and colleagues organize practical accident concerns around side effects, reward hacking, costly supervision, safe exploration, and distributional shift [1]. These issues motivate inspection of what a system optimizes and where its evaluation stops applying. A useful teaching example is a tutor rewarded only for completion rate: pressuring students to select answers could improve the metric while undermining learning. The toy stability score does not directly implement any of these mechanisms.

A learned system can also contain optimization behavior whose effective objective differs from the training objective. Hubinger and colleagues analyze this possibility under the term mesa-optimization [2]. An externally acceptable training score would then be insufficient to establish the learned optimizer's goals. This is a research concern, not a claim that every neural model contains a hidden agent, nor something that a scalar repair term detects.

Instrumental convergence concerns actions useful for many different objectives: obtaining resources, preserving options, maintaining access, or avoiding interruption may help an agent achieve its goal. Turner and colleagues provide conditional results about power-seeking tendencies of optimal policies in certain Markov decision processes [3]. Their result depends on environmental structure and objective assumptions. Optimal-policy arguments do not automatically describe real learned policies, and they do not prove that every possible ASI would seek domination.

The remaining observations here are architectural hypotheses rather than findings established by the dashboard. A tool-using system may exploit overly broad permissions if success depends on changing its environment. An evaluator dependent on the same information channel as the evaluated system may receive misleading evidence. A cluster using identical training data and evaluators may produce strongly correlated errors even when individual agents appear to agree. Faster action can outrun a review process that was designed for slower workflows. None of these possibilities is quantified by the 0–100 index.

## 10. Emergence and claims of inevitability

An apparent sudden capability change may reflect a real threshold, a benchmark's scoring rule, improved tools, or the choice of measurement. Plotting a smooth capability index and labeling thresholds as breakthroughs demonstrates how a continuous variable can generate discrete-looking events. It does not establish that specific scientific advances appear at particular compute levels.

Coordination can likewise create system-level behavior different from individual components. But this repository's aggregate overhead and diversity terms merely assume such effects. It does not show strategic cooperation, collusion, institutional behavior, or a collective goal emerging from independent policies.

Recursive improvement can be limited by bottlenecks even when proposal generation is fast. Informative experiments may take time; reliable evaluations may remain scarce; hardware supply may not respond instantly. Conversely, a bottleneck becoming less restrictive can change the growth regime. The appropriate response is to test alternative constraints, not select the fastest curve as the default forecast.

## 11. What “alignment limits” means

Several different limits should not be collapsed into one impossibility claim:

- **Specification:** human goals can be incomplete, contested, or dependent on context.
- **Measurement:** passing a bounded evaluation gives evidence about its tested conditions.
- **Adaptation:** tools, environments, and system modifications can change behavior after evaluation.
- **Control:** access restrictions, rollback, and independent review can depend on infrastructure outside the model.
- **Governance:** technical competence does not settle who may define objectives or accept risks.

This project proves no general impossibility theorem. Its bounded indices cannot distinguish honest compliance from strategic behavior or represent all relevant human values. A scalar guardrail control is therefore a pedagogical simplification, not a claim that alignment can be purchased as a percentage.

Possible layered interventions include narrowing tool access, staging changes, checking behavior under varied conditions, preserving auditability, and maintaining independent review. Their effectiveness would need evaluation against specific system designs and threats. The dashboard's “safety patch” is only a controllable model perturbation.

## 12. Reproducibility, verification, and responsible interpretation

Each scenario is deterministic given its initial parameters and tick-ordered actions. JSON exports include the seed-bearing constants, complete actions, final tick, trajectory history, and final state. Reconstruct a run by advancing to each action's tick, applying the recorded parameter change or named intervention in order, and advancing to the final tick. CSV contains physical units and all controls but cannot preserve multiple same-tick actions. Human-readable events are bounded to the latest 64.

Tests verify numerical finiteness at parameter extremes, unit accounting, power throttling, deterministic replay, growth ordering, zero-learning behavior, strong-versus-weak guardrail response, intervention decay, horizon behavior, and exports. These checks establish software behavior relative to its specification. They do not calibrate the model to reality or validate its theoretical assumptions.

For classroom exploration, reset before each comparison, vary one control, state the hypothesis being tested, and discuss which equations make the result happen. Useful questions include: When does adding requested compute stop helping? How does the active hypothesis affect pressure? Why can a patch improve a synthetic score without resolving objective specification? Which apparent breakthroughs disappear when a threshold is moved?

For research use, replace arbitrary coefficients with explicit evidence where possible, track uncertainty, define operational tasks, distinguish structural assumptions from parameter uncertainty, and compare several model families. Parameter sweeps in one invented equation are not a calibrated uncertainty interval. Do not make deployment decisions from this dashboard.

## References

1. D. Amodei et al. (2016), *Concrete Problems in AI Safety*. [arXiv:1606.06565](https://arxiv.org/abs/1606.06565). Cited for its practical accident-risk categories, not for this project's equations.
2. E. Hubinger et al. (2019; revised 2021), *Risks from Learned Optimization in Advanced Machine Learning Systems*. [arXiv:1906.01820](https://arxiv.org/abs/1906.01820). Cited for the distinction between training objectives and objectives of learned optimizers.
3. A. M. Turner et al. (2019; revised 2023), *Optimal Policies Tend to Seek Power*. [arXiv:1912.01683](https://arxiv.org/abs/1912.01683). Conditional optimal-policy results; the paper explicitly notes the gap to real-world learned policies.
4. R. Landauer (1989), *Dissipation and noise immunity in computation, measurement, and communication*. [IBM Research publication record](https://research.ibm.com/publications/dissipation-and-noise-immunity-in-computation-measurement-and-communication). Cited for the role of discarded information in computation's physical dissipation requirements.
5. GitHub, *Using custom workflows with GitHub Pages*. [Official documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Used for workflow configuration, not ASI theory.

Source records consulted October 7, 2026. All scenario equations and numeric coefficients are original teaching choices for this repository unless identified as a physical constant or principle.
