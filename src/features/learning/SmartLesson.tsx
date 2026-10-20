import { useEffect, useRef, useState } from 'react'

type LessonProgress = { completed: string[]; flashIndex: number; notes: Record<string, string> }

const PROGRESS_KEY = 'speakia-smart-lesson-progress-v1'
const LESSON_IDS = ['foundations', 'part1', 'part2', 'part3', 'grammar', 'vocabulary', 'studio']

function isLessonProgress(value: unknown): value is LessonProgress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return Array.isArray(candidate.completed)
    && candidate.completed.every((id) => typeof id === 'string' && LESSON_IDS.includes(id))
    && Number.isInteger(candidate.flashIndex)
    && (candidate.flashIndex as number) >= 0
    && (candidate.flashIndex as number) < 5
    && typeof candidate.notes === 'object'
    && candidate.notes !== null
    && !Array.isArray(candidate.notes)
    && Object.values(candidate.notes).every((note) => typeof note === 'string')
}

const smartLessonDocument = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f7f8fc">
<title>Smart lesson · Speakia</title>
<style>
:root{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#242438;background:#f7f8fc;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;--ink:#28283d;--muted:#85869a;--line:#eeedf4;--purple:#7059d9;--purple-soft:#f0edff;--mint:#def6eb;--peach:#fff0e7;--blue:#e8f1ff;--yellow:#fff5d9}
*{box-sizing:border-box}body{margin:0;min-width:340px;min-height:100vh}button,input,textarea{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #a99af8;outline-offset:2px}.shell{display:flex;height:100vh;min-height:760px;overflow:hidden;background:#f7f8fc}.rail{position:relative;z-index:2;display:flex;width:252px;flex:0 0 252px;flex-direction:column;padding:23px 15px 16px;background:#fff;border-right:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;padding:0 8px;margin-bottom:28px}.brand-mark{display:grid;width:35px;height:35px;place-items:center;color:#fff;background:linear-gradient(145deg,#9876f7,#624bd0);border-radius:12px;box-shadow:0 5px 12px #735cdc35}.brand-name{font-size:16px;font-weight:800;letter-spacing:-.5px}.brand-name span{color:#ed8e70}.brand-sub{margin-top:3px;color:#a09eae;font-size:9px;font-weight:600;letter-spacing:.65px}.rail-label{padding:0 10px;margin:0 0 9px;color:#a5a3b0;font-size:9px;font-weight:800;letter-spacing:1.15px}.lesson-nav{display:grid;gap:4px}.nav-button{display:flex;width:100%;min-height:41px;align-items:center;gap:10px;padding:0 10px;color:#79798d;background:transparent;border:0;border-radius:9px;text-align:left;font-size:11px;font-weight:600;transition:background .18s,color .18s}.nav-button:hover{color:#5845bf;background:#f8f7fc}.nav-button.active{color:#604bcc;background:#f0edff}.nav-icon{display:grid;width:25px;height:25px;flex:0 0 auto;place-items:center;background:#f4f4f8;border-radius:8px;font-size:13px}.nav-button.active .nav-icon{background:#e4defe}.nav-index{display:grid;width:18px;height:18px;place-items:center;margin-left:auto;color:#a5a3b1;background:#fff;border-radius:6px;font-size:9px}.rail-bottom{margin-top:auto}.rail-goal{padding:13px;background:#f9f7ff;border:1px solid #efecfa;border-radius:12px}.goal-icon{font-size:15px}.goal-title{margin:7px 0 4px;color:#39364d;font-size:11px;font-weight:750}.goal-copy{margin:0;color:#9290a0;font-size:9px;line-height:1.55}.goal-track{height:5px;overflow:hidden;margin-top:11px;background:#e9e5f6;border-radius:9px}.goal-track span{display:block;width:0;height:100%;background:linear-gradient(90deg,#ad8aff,#6c55d7);border-radius:inherit;transition:width .5s}.goal-count{display:flex;justify-content:space-between;margin-top:6px;color:#898798;font-size:9px}.rail-user{display:flex;align-items:center;gap:9px;padding:13px 5px 0;margin-top:13px;border-top:1px solid var(--line)}.user-avatar{display:grid;width:31px;height:31px;place-items:center;color:#704f47;background:#ffe5d9;border-radius:50%;font-size:11px;font-weight:800}.user-copy{display:grid;gap:3px}.user-copy strong{font-size:10px}.user-copy span{color:#9694a2;font-size:9px}.main{display:flex;min-width:0;flex:1;flex-direction:column}.topbar{z-index:1;display:flex;height:57px;flex:0 0 57px;align-items:center;justify-content:space-between;padding:0 30px;background:#ffffffed;border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}.crumb{display:flex;align-items:center;gap:8px;color:#aaa8b3;font-size:10px}.crumb strong{color:#555467;font-weight:650}.top-actions{display:flex;align-items:center;gap:8px}.streak{display:flex;align-items:center;gap:5px;padding:7px 10px;color:#876130;background:#fff6e6;border:1px solid #f5ebd4;border-radius:8px;font-size:10px;font-weight:700}.help-button{display:grid;width:29px;height:29px;place-items:center;color:#77768a;background:white;border:1px solid var(--line);border-radius:9px;font-size:12px}.scroll-area{flex:1;overflow:auto;scrollbar-color:#d7d3e5 transparent;scrollbar-width:thin}.wrap{width:min(1150px,100%);padding:28px 31px 35px;margin:0 auto}.welcome{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}.eyebrow{margin:0 0 7px;color:#8270d1;font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase}.welcome h1{margin:0;color:var(--ink);font-size:25px;letter-spacing:-.8px}.welcome p:not(.eyebrow){margin:6px 0 0;color:#8a899b;font-size:11px}.welcome-side{display:flex;align-items:center;gap:9px;color:#898797;font-size:10px}.welcome-avatar{display:grid;width:31px;height:31px;place-items:center;color:#fff;background:linear-gradient(145deg,#9c83f5,#6c54d2);border-radius:50%;font-size:11px;font-weight:800}.hero{position:relative;display:flex;min-height:187px;align-items:center;overflow:hidden;padding:25px 29px;color:white;background:linear-gradient(112deg,#443875 0%,#57428f 56%,#8064c6 100%);border-radius:17px;box-shadow:0 11px 24px #58449319}.hero:before,.hero:after{position:absolute;content:"";border:1px solid #ffffff19;border-radius:50%}.hero:before{top:-129px;right:12%;width:330px;height:330px}.hero:after{top:-89px;right:15%;width:250px;height:250px}.hero-copy{position:relative;z-index:1;max-width:515px}.hero-tag{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;color:#eee9ff;background:#ffffff18;border:1px solid #ffffff1d;border-radius:99px;font-size:8px;font-weight:700;letter-spacing:.4px}.hero h2{max-width:430px;margin:11px 0 7px;font-size:23px;line-height:1.18;letter-spacing:-.65px}.hero h2 em{color:#ffc2a2;font-style:normal}.hero p{max-width:395px;margin:0 0 14px;color:#ded9ef;font-size:10px;line-height:1.65}.primary-button{display:inline-flex;min-height:33px;align-items:center;justify-content:center;gap:7px;padding:0 12px;color:white;background:#7560de;border:0;border-radius:8px;font-size:10px;font-weight:750;box-shadow:0 4px 10px #5c49c530;transition:transform .15s,background .15s}.primary-button:hover{background:#634dcf;transform:translateY(-1px)}.hero .primary-button{color:#54418d;background:#fff;box-shadow:none}.hero .primary-button:hover{background:#f5f1ff}.hero-art{position:absolute;top:0;right:4%;width:260px;height:100%;display:grid;place-items:center}.art-orbit{position:absolute;width:177px;height:177px;border:1px solid #ffffff21;border-radius:50%;animation:orbit 30s linear infinite}.art-orbit:before,.art-orbit:after{position:absolute;width:8px;height:8px;content:"";background:#ffc3a4;border-radius:50%;box-shadow:0 0 0 5px #ffc3a420}.art-orbit:before{top:23px;left:25px}.art-orbit:after{right:1px;bottom:35px;background:#99eed0;box-shadow:0 0 0 5px #99eed020}.art-book{position:relative;display:grid;width:87px;height:91px;place-items:center;background:linear-gradient(145deg,#fff5df,#ffd4b8);border:5px solid #ffffff70;border-radius:19px;box-shadow:0 16px 35px #30245445;font-size:39px;transform:rotate(-8deg);animation:bob 3.3s ease-in-out infinite}.art-star{position:absolute;top:33px;right:18px;color:#ffeaa9;font-size:24px;animation:pulse 2.2s ease-in-out infinite}.art-spark{position:absolute;bottom:37px;left:26px;color:#b6f1dc;font-size:20px}.quick-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:13px 0 22px}.stat-card{display:flex;min-height:62px;align-items:center;gap:10px;padding:11px 13px;background:#fff;border:1px solid var(--line);border-radius:11px}.stat-icon{display:grid;width:35px;height:35px;flex:0 0 auto;place-items:center;border-radius:10px;font-size:16px}.stat-icon.purple{background:#f0edff}.stat-icon.mint{background:#e6f8ef}.stat-icon.peach{background:#fff0e7}.stat-copy{display:grid;gap:3px}.stat-copy strong{color:#343448;font-size:13px}.stat-copy span{color:#9694a3;font-size:9px}.section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:0 0 11px}.section-heading h2{margin:0;color:#343448;font-size:14px;letter-spacing:-.25px}.section-heading p{margin:4px 0 0;color:#9997a5;font-size:9px}.text-button{padding:5px;color:#7058d4;background:transparent;border:0;font-size:9px;font-weight:750}.course-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.course-card{display:flex;min-height:95px;align-items:flex-start;gap:11px;padding:13px;background:#fff;border:1px solid var(--line);border-radius:12px;text-align:left;transition:transform .16s,border .16s,box-shadow .16s}.course-card:hover{transform:translateY(-2px);border-color:#d9d2f5;box-shadow:0 7px 20px #5147830c}.course-icon{display:grid;width:37px;height:37px;flex:0 0 auto;place-items:center;border-radius:11px;font-size:17px}.course-copy{min-width:0;flex:1}.course-topline{display:flex;align-items:center;gap:6px;margin:1px 0 5px}.course-copy strong{color:#383749;font-size:11px}.course-copy p{margin:0;color:#92909f;font-size:9px;line-height:1.55}.course-meta{display:flex;align-items:center;justify-content:space-between;margin-top:8px;color:#a09eab;font-size:8px}.course-status{color:#54a17d;font-weight:750}.content-grid{display:grid;grid-template-columns:minmax(0,1fr) 238px;align-items:start;gap:13px;margin-top:14px}.panel{padding:16px;background:#fff;border:1px solid var(--line);border-radius:12px}.lesson-head{display:flex;align-items:flex-start;justify-content:space-between;gap:13px;margin-bottom:14px}.lesson-head h2{margin:4px 0 5px;color:#303044;font-size:20px;letter-spacing:-.55px}.lesson-head p{margin:0;color:#8c8a9a;font-size:10px;line-height:1.6}.lesson-chip{flex:0 0 auto;padding:6px 8px;color:#715ad3;background:#f2efff;border-radius:7px;font-size:8px;font-weight:800;letter-spacing:.4px}.concept-card{padding:13px 14px;margin-bottom:10px;background:linear-gradient(120deg,#f8f6ff,#fbfaff);border:1px solid #eeebfa;border-radius:10px}.concept-kicker{margin:0 0 6px;color:#7965cf;font-size:8px;font-weight:800;letter-spacing:.9px;text-transform:uppercase}.concept-card h3{margin:0 0 6px;color:#39374b;font-size:12px}.concept-card p{margin:0;color:#777689;font-size:10px;line-height:1.72}.definition-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}.definition{padding:11px;background:#fff;border:1px solid var(--line);border-radius:9px}.definition-icon{font-size:14px}.definition h3{margin:6px 0 4px;color:#414052;font-size:10px}.definition p{margin:0;color:#898798;font-size:9px;line-height:1.6}.example-box{padding:12px;margin:10px 0;background:#f3faf6;border-left:3px solid #7dc8a2;border-radius:0 9px 9px 0}.example-label{margin:0 0 6px;color:#508f6f;font-size:8px;font-weight:800;letter-spacing:.7px;text-transform:uppercase}.example-box p{margin:0;color:#525b5b;font-size:10px;line-height:1.75}.example-box strong{color:#3b7256}.activity{padding:13px;margin-top:12px;background:#fcfbff;border:1px solid #eae7f5;border-radius:10px}.activity-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}.activity-head h3{margin:0;color:#39384c;font-size:11px}.activity-label{color:#a09cac;font-size:8px;font-weight:750;letter-spacing:.5px}.question{margin:0 0 9px;color:#575669;font-size:10px;line-height:1.6}.options{display:grid;gap:6px}.option{display:flex;width:100%;align-items:flex-start;gap:8px;padding:9px 10px;color:#666577;background:#fff;border:1px solid #ebe9f1;border-radius:8px;text-align:left;font-size:9px;line-height:1.55;transition:border .15s,background .15s}.option:hover{border-color:#c9bdf5;background:#faf9ff}.option.selected{border-color:#8f7ae5;background:#f7f4ff}.option.correct{border-color:#84c9a4;background:#f0faf4}.option.incorrect{border-color:#f0a49a;background:#fff5f2}.option-letter{display:grid;width:17px;height:17px;flex:0 0 auto;place-items:center;color:#8c879a;background:#f3f2f7;border-radius:5px;font-size:8px;font-weight:800}.feedback{display:none;padding:9px 10px;margin-top:8px;border-radius:8px;font-size:9px;line-height:1.6}.feedback.show{display:block}.feedback.good{color:#397b58;background:#eefaef}.feedback.try{color:#9c594e;background:#fff1ed}.tip-card{padding:13px;background:#fff9e8;border:1px solid #f5edda;border-radius:11px}.tip-card h3{margin:0 0 7px;color:#796335;font-size:10px}.tip-card p{margin:0;color:#887d69;font-size:9px;line-height:1.65}.tip-card .tip-icon{margin-right:5px}.template-card{padding:11px;margin-top:10px;background:#fff;border:1px dashed #ddd8ee;border-radius:9px}.template-card h3{margin:0 0 7px;color:#4d4960;font-size:10px}.template-card p{margin:0;color:#777487;font-size:9px;line-height:1.8}.template-card button{margin-top:8px;padding:5px 8px;color:#6b55ca;background:#f3f0ff;border:0;border-radius:6px;font-size:8px;font-weight:750}.complete-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:13px;margin-top:14px;border-top:1px solid var(--line)}.complete-copy{color:#9391a0;font-size:9px;line-height:1.45}.complete-button{min-height:31px;padding:0 10px;color:#fff;background:#7059d9;border:0;border-radius:7px;font-size:9px;font-weight:750}.complete-button.done{color:#478664;background:#e8f7ef}.side-stack{display:grid;gap:10px}.side-card h3{margin:0 0 10px;color:#404052;font-size:10px}.side-card p{margin:0;color:#8b8999;font-size:9px;line-height:1.65}.side-card{padding:13px;background:white;border:1px solid var(--line);border-radius:11px}.side-card.purple-card{background:#f7f4ff;border-color:#ece7fa}.mini-steps{display:grid;gap:8px;margin-top:9px}.mini-step{display:flex;align-items:center;gap:8px;color:#767486;font-size:9px}.step-dot{display:grid;width:20px;height:20px;flex:0 0 auto;place-items:center;color:#735ed0;background:#eae5ff;border-radius:7px;font-size:8px;font-weight:800}.word{display:inline-block;padding:3px 6px;color:#5a49ac;background:#f0edff;border-radius:5px;font-weight:750}.vocab-card{display:grid;min-height:137px;place-items:center;padding:16px;margin-bottom:10px;background:linear-gradient(135deg,#f5f2ff,#fff7ef);border:1px solid #eae5f8;border-radius:12px;text-align:center;cursor:pointer;transition:transform .25s}.vocab-card:hover{transform:translateY(-2px)}.vocab-term{color:#473b79;font-size:20px;font-weight:800;letter-spacing:-.4px}.vocab-type{margin-top:5px;color:#9088a9;font-size:8px;font-weight:700;letter-spacing:.65px;text-transform:uppercase}.vocab-meaning{max-width:350px;margin-top:11px;color:#6e6b7c;font-size:10px;line-height:1.6}.vocab-controls{display:flex;align-items:center;justify-content:space-between;gap:8px}.small-button{min-height:29px;padding:0 9px;color:#6954c5;background:#f2efff;border:0;border-radius:7px;font-size:9px;font-weight:750}.small-button.secondary{color:#6e6d7d;background:#f5f5f8}.text-input,.answer-area{width:100%;padding:9px 10px;color:#464456;background:#fff;border:1px solid #e8e6ef;border-radius:8px;font-size:10px}.answer-area{min-height:110px;resize:vertical;line-height:1.7}.input-row{display:flex;gap:7px;margin-top:8px}.input-row .text-input{flex:1}.timer-display{padding:14px;margin:9px 0;color:#5e4db6;background:#f4f1ff;border-radius:10px;text-align:center;font-size:25px;font-variant-numeric:tabular-nums;font-weight:800;letter-spacing:1px}.timer-controls{display:flex;justify-content:center;gap:7px}.model-answer{display:none;padding:11px;margin-top:9px;color:#666477;background:#f5f8ff;border:1px solid #e9edf8;border-radius:8px;font-size:9px;line-height:1.75}.model-answer.show{display:block;animation:fadeIn .22s ease}.model-answer strong{color:#4e4991}.progress-banner{display:flex;align-items:center;gap:12px;padding:12px;margin-top:18px;background:#fff;border:1px solid var(--line);border-radius:11px}.progress-ring{display:grid;width:37px;height:37px;flex:0 0 auto;place-items:center;color:#6650c8;background:conic-gradient(#8974e5 0deg,#e8e4f5 0deg);border-radius:50%;font-size:9px;font-weight:800}.progress-copy{flex:1}.progress-copy strong{color:#444356;font-size:10px}.progress-copy p{margin:4px 0 0;color:#9896a4;font-size:8px}.progress-line{height:5px;overflow:hidden;margin-top:7px;background:#efedf5;border-radius:9px}.progress-line span{display:block;width:0;height:100%;background:linear-gradient(90deg,#b293f7,#7159d9);border-radius:inherit;transition:width .4s}.status{min-height:14px;margin:7px 0 0;color:#706a87;font-size:9px}.status:empty{display:none}.footer-note{padding:14px 0 2px;color:#aaa8b5;text-align:center;font-size:8px}.template-tabs{display:flex;gap:6px;overflow:auto;padding:2px 0 8px}.template-tab{flex:0 0 auto;padding:6px 9px;color:#7d7a8c;background:#f6f5f9;border:0;border-radius:7px;font-size:8px;font-weight:750}.template-tab.active{color:#634ec2;background:#eeeaff}.template-result{padding:12px;background:#fbfaff;border:1px solid #ebe8f4;border-radius:9px}.template-result h3{margin:0 0 7px;color:#49465d;font-size:10px}.template-result p{margin:0;color:#777487;font-size:9px;line-height:1.85;white-space:pre-wrap}
@keyframes bob{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-7px) rotate(-5deg)}}@keyframes orbit{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.2);opacity:1}}@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
@media(max-width:940px){.rail{width:220px;flex-basis:220px}.wrap{padding-right:20px;padding-left:20px}.content-grid{grid-template-columns:minmax(0,1fr) 205px}.hero-art{right:0;opacity:.8}}
@media(max-width:720px){.shell{height:auto;min-height:100vh;overflow:visible;flex-direction:column}.rail{width:100%;flex:0 0 auto;padding:12px 14px 9px;border-right:0;border-bottom:1px solid var(--line)}.brand{margin:0 0 10px}.rail-label,.rail-bottom{display:none}.lesson-nav{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px}.nav-button{width:auto;min-width:max-content;min-height:34px;gap:6px;padding:0 8px;font-size:9px}.nav-icon{width:21px;height:21px}.nav-index{display:none}.main{min-height:0}.topbar{height:45px;flex-basis:45px;padding:0 15px}.wrap{padding:20px 14px 27px}.welcome h1{font-size:21px}.hero{min-height:175px;padding:20px}.hero h2{max-width:380px;font-size:21px}.hero-art{right:-53px;opacity:.45}.quick-stats{gap:6px}.stat-card{min-height:56px;gap:7px;padding:8px}.stat-icon{width:29px;height:29px;font-size:14px}.stat-copy strong{font-size:11px}.stat-copy span{font-size:8px}.content-grid{grid-template-columns:1fr}.side-stack{grid-template-columns:repeat(2,minmax(0,1fr))}.main{width:100%}}
@media(max-width:480px){.wrap{padding-right:11px;padding-left:11px}.welcome{align-items:flex-start}.welcome-side{font-size:8px}.welcome-avatar{width:27px;height:27px}.hero{min-height:185px;padding:16px}.hero h2{max-width:300px;font-size:20px}.hero p{max-width:300px;font-size:9px}.hero-art{right:-95px}.quick-stats{grid-template-columns:1fr}.stat-card{min-height:48px}.course-grid{grid-template-columns:1fr}.course-card{min-height:80px}.definition-grid{grid-template-columns:1fr 1fr}.side-stack{grid-template-columns:1fr 1fr}.side-card{padding:10px}.lesson-head h2{font-size:18px}.panel{padding:12px}.streak{font-size:9px}}
</style>
<style>
.shell{height:100%;min-height:0;flex-direction:column;overflow:hidden}
.rail{width:100%;height:auto;min-height:66px;flex:0 0 auto;flex-direction:row;align-items:center;gap:18px;padding:9px 24px;background:#fff;border-right:0;border-bottom:1px solid var(--line)}
.brand{flex:0 0 auto;padding:0;margin:0}
.brand-sub{font-size:10px}
.rail-label,.rail-bottom{display:none}
.lesson-nav{display:flex;min-width:0;flex:1;justify-content:flex-start;gap:5px;overflow-x:auto;scrollbar-width:thin}
.nav-button{width:auto;min-width:max-content;min-height:39px;gap:7px;padding:0 9px;font-size:12px}
.nav-index{margin-left:1px;font-size:10px}
.main{min-height:0}
.topbar{height:48px;min-height:48px;flex-basis:48px;padding:0 26px}
.wrap :where(p,button,label,input,textarea,select,small){font-size:max(12px,1em)}
.wrap :where(.eyebrow,.activity-label,.lesson-chip,.course-meta,.course-status,.vocab-type,.text-button,.footer-note,.mini-step,.status){font-size:12px}
.wrap :where(.section-heading h2,.course-copy strong,.stat-copy strong,.side-card h3,.activity-head h3,.definition h3,.template-card h3,.template-result h3,.tip-card h3,.complete-button,.small-button,.template-tab){font-size:13px}
.welcome h1{font-size:27px}
.welcome p:not(.eyebrow){font-size:14px}
.hero h2{font-size:25px}
.hero p,.course-copy p,.definition p,.concept-card p,.example-box p,.side-card p,.tip-card p,.template-card p,.template-result p,.question,.option,.feedback,.complete-copy{font-size:14px}
.nav-button{font-size:12px}
@media(max-width:940px){.rail{gap:12px;padding-right:16px;padding-left:16px}.lesson-nav{justify-content:flex-start}.nav-button{padding:0 7px}.wrap{padding-right:20px;padding-left:20px}}
@media(max-width:720px){.rail{min-height:58px;flex-direction:column;align-items:stretch;gap:8px;padding:9px 12px 7px}.brand{display:none}.lesson-nav{width:100%;justify-content:flex-start}.nav-button{min-height:35px;font-size:11px}.topbar{height:42px;min-height:42px;flex-basis:42px;padding:0 15px}.wrap{padding:20px 14px 27px}}
@media(max-width:480px){.nav-button{min-height:33px;padding:0 7px;font-size:10px}.nav-icon{width:21px;height:21px}.wrap{padding-right:11px;padding-left:11px}.welcome h1{font-size:23px}.welcome p:not(.eyebrow){font-size:13px}.hero h2{font-size:22px}.hero p,.course-copy p,.definition p,.concept-card p,.example-box p,.side-card p,.tip-card p,.template-card p,.template-result p,.question,.option,.feedback,.complete-copy{font-size:13px}}
</style>
</head>
<body>
<div class="shell">
  <aside class="rail">
    <div class="brand"><div class="brand-mark">✦</div><div><div class="brand-name">smart lesson<span>.</span></div><div class="brand-sub">YOUR IELTS SPEAKING STUDIO</div></div></div>
    <p class="rail-label">YOUR LEARNING PATH</p>
    <nav class="lesson-nav" id="lessonNav" aria-label="Lesson topics"></nav>
    <div class="rail-bottom">
      <div class="rail-goal"><span class="goal-icon">🌱</span><p class="goal-title">One lesson at a time</p><p class="goal-copy">Small, focused practice is how confident speakers grow.</p><div class="goal-track"><span id="railProgress"></span></div><div class="goal-count"><span>Course progress</span><span id="railCount">0 / 7</span></div></div>
      <div class="rail-user"><div class="user-avatar">M</div><div class="user-copy"><strong>Your study space</strong><span>IELTS speaking · self-paced</span></div></div>
    </div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="crumb"><span>My learning</span><span>›</span><strong id="breadcrumb">Smart lesson</strong></div><div class="top-actions"><span class="streak">🔥 <span id="streakCount">0</span> lessons complete</span><button class="help-button" id="helpButton" aria-label="Show learning tip" title="Learning tip">?</button></div></header>
    <div class="scroll-area" id="scrollArea"><div class="wrap" id="page"></div></div>
  </main>
</div>
<script>
(() => {
  const topics = [
    {id:"foundations",icon:"🧭",title:"Speaking foundations",short:"Build confident, natural answers",time:"8 min",color:"purple"},
    {id:"part1",icon:"☕",title:"Part 1 · everyday chat",short:"Make short answers memorable",time:"10 min",color:"peach"},
    {id:"part2",icon:"🎙️",title:"Part 2 · tell a story",short:"Plan and deliver your cue card",time:"12 min",color:"mint"},
    {id:"part3",icon:"💭",title:"Part 3 · deeper ideas",short:"Explain, support and explore",time:"10 min",color:"blue"},
    {id:"grammar",icon:"🧩",title:"Grammar that speaks",short:"Sound clear, flexible and natural",time:"9 min",color:"yellow"},
    {id:"vocabulary",icon:"🌈",title:"Vocabulary garden",short:"Grow useful topic vocabulary",time:"7 min",color:"purple"},
    {id:"studio",icon:"📝",title:"Speaking practice studio",short:"Put your learning into practice",time:"10 min",color:"peach"}
  ];
  const flashcards = [
    {term:"a welcome change of pace",type:"Expression · lifestyle",meaning:"A pleasant difference from your usual routine.",example:"A weekend by the sea is a welcome change of pace after a busy week."},
    {term:"broaden your horizons",type:"Phrase · experiences",meaning:"To gain new experiences and learn about different perspectives.",example:"Travelling alone helped me broaden my horizons and become more independent."},
    {term:"strike a balance",type:"Collocation · work & life",meaning:"To find a reasonable middle point between competing needs.",example:"I try to strike a balance between my studies and spending time with friends."},
    {term:"what I appreciate most is…",type:"Natural expression · opinions",meaning:"A clear way to emphasize the aspect you value the most.",example:"What I appreciate most is how welcoming the people in my neighbourhood are."},
    {term:"picturesque",type:"Adjective · places",meaning:"Visually attractive in a charming or distinctive way.",example:"We spent the afternoon wandering through a picturesque coastal village."}
  ];
  const templates = {
    "Part 1":{title:"A natural short answer",text:"Direct answer → a little detail → a personal reason\n\n“Usually, I prefer ___, especially when ___. I think that’s because ___.”"},
    "Part 2":{title:"A story that flows",text:"Set the scene → what happened → a detail or feeling → why it matters\n\n“I’d like to talk about ___. I first came across it when ___. What stands out most is ___. Looking back, it was memorable because ___.”"},
    "Part 3":{title:"A thoughtful discussion answer",text:"Opinion → why → specific example → wider implication\n\n“On balance, I’d say ___. The main reason is ___. For example, ___. So, in the long term, this could ___.”"}
  };
  let state = __SMART_LESSON_PROGRESS__;
  let current = "home";
  let timerId = null;
  let secondsLeft = 60;
  let activeTemplate = "Part 1";
  const page = document.getElementById("page");
  const nav = document.getElementById("lessonNav");
  const announce = (message) => {
    let node = document.getElementById("globalStatus");
    if (!node) { node = document.createElement("div"); node.id = "globalStatus"; node.className = "status"; node.setAttribute("role","status"); document.querySelector(".topbar").after(node); }
    node.textContent = message;
  };
  function saveProgress() {
    window.parent.postMessage({type:"speakia:lesson-progress",progress:state},"*");
    updateProgress();
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g,(character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
  }
  function updateProgress() {
    const count = state.completed.length;
    const percent = Math.round(count/topics.length*100);
    const fill = document.getElementById("railProgress");
    const label = document.getElementById("railCount");
    const streak = document.getElementById("streakCount");
    if (fill) fill.style.width = percent+"%";
    if (label) label.textContent = count+" / "+topics.length;
    if (streak) streak.textContent = String(count);
    const message = document.getElementById("progressMessage");
    if (message) message.textContent = count === topics.length
      ? "Amazing work—you’ve explored every lesson. Keep practising to make those skills feel natural."
      : count > 0
        ? "You’ve completed "+count+" lesson"+(count===1?"":"s")+". Keep going at your own pace."
        : "Explore the lessons and build up your speaking toolkit, one step at a time.";
    const ring = document.getElementById("progressRing");
    if (ring) { ring.style.background = "conic-gradient(#8974e5 "+(percent*3.6)+"deg,#e8e4f5 0deg)"; ring.textContent = percent+"%"; }
    const line = document.getElementById("progressLine");
    if (line) line.style.width = percent+"%";
    topics.forEach((topic) => {
      const button = nav.querySelector('[data-topic="'+topic.id+'"]');
      if (button) {
        const index = button.querySelector(".nav-index");
        if (index) index.textContent = state.completed.includes(topic.id) ? "✓" : String(topics.indexOf(topic)+1);
      }
    });
  }
  function renderNav() {
    nav.innerHTML = topics.map((topic,index) => '<button class="nav-button" data-topic="'+topic.id+'"><span class="nav-icon">'+topic.icon+'</span><span>'+topic.title+'</span><span class="nav-index">'+(state.completed.includes(topic.id)?"✓":index+1)+'</span></button>').join("");
    nav.addEventListener("click",(event) => {
      const button = event.target.closest("[data-topic]");
      if (button) showTopic(button.dataset.topic);
    });
  }
  const courseCards = () => topics.map((topic,index) => '<button class="course-card" data-topic="'+topic.id+'"><span class="course-icon" style="background:'+({purple:"#f0edff",peach:"#fff0e7",mint:"#e6f8ef",blue:"#e8f1ff",yellow:"#fff5d9"}[topic.color])+'">'+topic.icon+'</span><span class="course-copy"><span class="course-topline"><strong>'+topic.title+'</strong></span><p>'+topic.short+'</p><span class="course-meta"><span>'+topic.time+' · Lesson '+(index+1)+'</span><span class="course-status">'+(state.completed.includes(topic.id)?"✓ Complete":"Start lesson →")+'</span></span></span></button>').join("");
  function renderHome() {
    current = "home";
    document.getElementById("breadcrumb").textContent = "Smart lesson";
    page.innerHTML = '<div class="welcome"><div><p class="eyebrow">YOUR PERSONAL IELTS SPEAKING COURSE</p><h1>Hi, Maya. Ready to find your voice? <span aria-hidden="true">👋</span></h1><p>A friendly, focused walkthrough from your first answer to confident conversation.</p></div><div class="welcome-side"><span>Made for your next big step</span><span class="welcome-avatar">M</span></div></div>'+
      '<section class="hero"><div class="hero-copy"><span class="hero-tag">✦ &nbsp;THE SMART LESSON EXPERIENCE</span><h2>Speak with more <em>clarity, colour & confidence.</em></h2><p>Learn the patterns, practise with purpose, and make every answer sound like you. Your complete IELTS Speaking walkthrough starts here.</p><button class="primary-button" data-topic="'+(topics.find((topic)=>!state.completed.includes(topic.id))||topics[0]).id+'">Continue learning <span>→</span></button></div><div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-book">📖</div><span class="art-star">✦</span><span class="art-spark">✧</span></div></section>'+
      '<div class="quick-stats"><div class="stat-card"><span class="stat-icon purple">🧠</span><span class="stat-copy"><strong>7 bite-sized lessons</strong><span>From speaking basics to a full practice run</span></span></div><div class="stat-card"><span class="stat-icon mint">🎯</span><span class="stat-copy"><strong>Learn by doing</strong><span>Examples, quick checks and practice prompts</span></span></div><div class="stat-card"><span class="stat-icon peach">🌱</span><span class="stat-copy"><strong>At your own pace</strong><span>Your progress stays in this browser</span></span></div></div>'+
      '<div class="section-heading"><div><h2>Your learning path</h2><p>Choose a lesson or pick up where you left off.</p></div><span class="text-button">'+state.completed.length+' of 7 complete</span></div><div class="course-grid">'+courseCards()+'</div>'+
      '<div class="progress-banner"><div class="progress-ring" id="progressRing">0%</div><div class="progress-copy"><strong>A little practice goes a long way</strong><p id="progressMessage">Explore the lessons and build up your speaking toolkit, one step at a time.</p><div class="progress-line"><span id="progressLine"></span></div></div></div><div class="footer-note">Designed for practice and learning · IELTS is a registered trademark of its respective owners.</div>';
    updateProgress();
  }
  const sectionHead = (topic,eyebrow,description) => '<div class="lesson-head"><div><p class="eyebrow">'+eyebrow+'</p><h2>'+topic.title+'</h2><p>'+description+'</p></div><span class="lesson-chip">'+topic.time.toUpperCase()+'</span></div>';
  const completionButton = (id) => '<div class="complete-row"><span class="complete-copy">No rush. Mark this lesson complete when you feel ready.</span><button class="complete-button '+(state.completed.includes(id)?"done":"")+'" id="completeLesson">'+(state.completed.includes(id)?"✓ Lesson complete":"Mark lesson complete")+'</button></div>';
  const lessonSide = (tip,steps) => '<aside class="side-stack"><div class="side-card purple-card"><h3>💡 &nbsp;Coach’s note</h3><p>'+tip+'</p></div><div class="side-card"><h3>Your mini roadmap</h3><div class="mini-steps">'+steps.map((step,index)=>'<div class="mini-step"><span class="step-dot">'+(index+1)+'</span><span>'+step+'</span></div>').join("")+'</div></div><div class="side-card"><h3>Keep it natural</h3><p>There is no single “perfect” answer. Clear ideas and your own voice matter more than memorised phrases.</p></div></aside>';
  function foundations(topic) {
    return sectionHead(topic,"THE SPEAKING TEST · YOUR STARTING POINT","Get to know what the examiner listens for, then build an answer that feels clear and genuinely yours.")+
      '<div class="concept-card"><p class="concept-kicker">A friendly first principle</p><h3>You are having a conversation, not giving a speech.</h3><p>The IELTS Speaking test is a face-to-face conversation in three parts. You’ll be assessed across four equally important areas. Aim to communicate your ideas clearly—not to sound like somebody else.</p></div>'+
      '<div class="definition-grid"><article class="definition"><span class="definition-icon">🌊</span><h3>Fluency & coherence</h3><p>Keep speaking at a natural pace and connect your ideas so your answer is easy to follow.</p></article><article class="definition"><span class="definition-icon">🎨</span><h3>Lexical resource</h3><p>Choose words that express your meaning precisely. Useful variety beats complicated words.</p></article><article class="definition"><span class="definition-icon">🧩</span><h3>Grammar range & accuracy</h3><p>Use a mix of sentence structures while keeping your meaning clear and correct.</p></article><article class="definition"><span class="definition-icon">🔊</span><h3>Pronunciation</h3><p>Make your words easy to understand with clear sounds, stress and natural rhythm.</p></article></div>'+
      '<div class="example-box"><p class="example-label">Try the four-step answer · A.R.E.</p><p><strong>Answer:</strong> “Yes, definitely.” <strong>Reason:</strong> “I find cooking really relaxing.” <strong>Example:</strong> “I made pasta with my sister last weekend.” <strong>Extend:</strong> “It’s become a little tradition for us.”</p></div>'+
      '<div class="activity" data-quiz="foundations"><div class="activity-head"><h3>Quick check: what makes an answer easier to follow?</h3><span class="activity-label">1 QUESTION</span></div><p class="question">Choose the strongest next step after answering the question directly.</p><div class="options"><button class="option" data-correct="false"><span class="option-letter">A</span>Use as many advanced words as possible.</button><button class="option" data-correct="true"><span class="option-letter">B</span>Add a reason and a small, specific example.</button><button class="option" data-correct="false"><span class="option-letter">C</span>Memorise a long answer before the test.</button></div><div class="feedback" role="status"></div></div>'+
      '<div class="template-card"><h3>A simple answer-building reminder</h3><p><span class="word">Answer</span> → <span class="word">Reason</span> → <span class="word">Example</span> → <span class="word">Extend</span><br>Use the parts that fit the question. A short, direct answer is perfectly fine when it feels complete.</p></div>'+completionButton(topic.id);
  }
  function partOne(topic) {
    return sectionHead(topic,"PART 1 · FAMILIAR TOPICS","Questions about everyday life are your chance to settle in and answer naturally. Most responses need just a few connected sentences.")+
      '<div class="concept-card"><p class="concept-kicker">A useful answer shape</p><h3>Answer clearly, then add one personal detail.</h3><p>Start with your real answer. Add a reason, preference or small example to help the conversation flow. You don’t need to stretch every answer into a speech.</p></div>'+
      '<div class="example-box"><p class="example-label">Question · What do you like doing at weekends?</p><p>“I usually go for a long walk, especially if the weather is nice. There’s a park near my home, and walking there helps me <strong>unwind after a busy week</strong>.”</p></div>'+
      '<div class="concept-card"><p class="concept-kicker">Why this feels natural</p><p>It answers directly, adds a real detail, and uses a phrase that fits the context. It stays focused on the question—no memorised introduction needed.</p></div>'+
      '<div class="activity" data-quiz="part1"><div class="activity-head"><h3>Choose the answer that sounds most conversational</h3><span class="activity-label">LISTEN FOR NATURALNESS</span></div><p class="question">Question: “Do you enjoy reading?”</p><div class="options"><button class="option" data-correct="false"><span class="option-letter">A</span>Reading is an activity with many cognitive and social advantages which I have enjoyed since childhood.</button><button class="option" data-correct="true"><span class="option-letter">B</span>Yes, I do. I usually read before bed because it helps me switch off.</button><button class="option" data-correct="false"><span class="option-letter">C</span>Yes. I enjoy reading. Reading is nice. I read books.</button></div><div class="feedback" role="status"></div></div>'+
      '<div class="template-card"><h3>Your turn · Try these warm-up questions</h3><p>What kind of music do you enjoy? &nbsp;·&nbsp; Is there a place you like to visit? &nbsp;·&nbsp; What did you do last weekend?</p><button data-action="show-part1-tips">Show a quick speaking tip</button><p class="status" id="part1Tip"></p></div>'+completionButton(topic.id);
  }
  function partTwo(topic) {
    return sectionHead(topic,"PART 2 · YOUR LONG TURN","You’ll get a task card, one minute to prepare, and up to two minutes to speak. Jot down ideas—not a full script.")+
      '<div class="concept-card"><p class="concept-kicker">Your cue card</p><h3>Describe a place you visited that you would like to go back to.</h3><p>You should say: where it is · when you went there · what you did there · and explain why you would like to visit it again.</p></div>'+
      '<div class="definition-grid"><article class="definition"><span class="definition-icon">🧭</span><h3>1 · Set the scene</h3><p>Name the place and say when you visited.</p></article><article class="definition"><span class="definition-icon">📍</span><h3>2 · Add details</h3><p>Choose one or two moments worth describing.</p></article><article class="definition"><span class="definition-icon">💬</span><h3>3 · Show how you felt</h3><p>Say what you noticed or enjoyed.</p></article><article class="definition"><span class="definition-icon">✨</span><h3>4 · Make it meaningful</h3><p>Explain why you want to go back.</p></article></div>'+
      '<div class="activity"><div class="activity-head"><h3>Your one-minute preparation</h3><span class="activity-label">PLAN, DON’T SCRIPT</span></div><p class="question">Start the timer, then note a place, two details and one feeling. Your notes can be just keywords.</p><div class="timer-display" id="timerDisplay">01:00</div><div class="timer-controls"><button class="small-button" id="timerStart">▶ Start 1-minute prep</button><button class="small-button secondary" id="timerReset">↺ Reset</button></div><label for="practiceNotes" class="activity-label" style="display:block;margin:13px 0 6px">MY KEYWORD NOTES</label><textarea class="answer-area" id="practiceNotes" placeholder="Place · when · one moment · how it felt…"></textarea><div class="course-meta"><span id="wordCount">0 words</span><span>Notes save in this browser</span></div></div>'+
      '<button class="text-button" id="modelToggle" aria-expanded="false">Read a sample response ↓</button><div class="model-answer" id="modelAnswer"><strong>Sample answer · a coastal town</strong><br>I’d like to talk about a small coastal town I visited with my family last summer. We went for a few days because we wanted a quiet break from the city. What I remember most is walking along the harbour in the early evening. The boats were coming back, and the whole place had this really peaceful atmosphere. We also found a little café overlooking the water, where we tried some local seafood. I’d love to go back because we only stayed for a short time. There are still some walking trails I’d like to explore, and honestly, it was a welcome change of pace. I felt completely relaxed there.</div>'+completionButton(topic.id);
  }
  function partThree(topic) {
    return sectionHead(topic,"PART 3 · DISCUSS & DEVELOP","These questions invite you to explain your opinions and think about the bigger picture. There can be several reasonable answers.")+
      '<div class="concept-card"><p class="concept-kicker">A flexible way to organise an idea</p><h3>I.D.E.A. · a guide, not a script</h3><p><strong>I</strong>dea: make your point. <strong>D</strong>evelop: explain why. <strong>E</strong>xample: make it concrete. <strong>A</strong>fterward: mention an effect or contrast if it helps.</p></div>'+
      '<div class="example-box"><p class="example-label">Question · How can cities encourage people to use public transport?</p><p>“I think reliability is probably the most important thing. If buses and trains arrive on time, people can plan their day with confidence. <strong>For example</strong>, where I live, a new bus route made it much easier for students to get to the university. <strong>In the long run</strong>, that could also reduce traffic in the city centre.”</p></div>'+
      '<div class="concept-card"><p class="concept-kicker">Useful language · opinions & contrast</p><p><span class="word">On balance…</span> &nbsp;<span class="word">One reason for this is…</span> &nbsp;<span class="word">For instance…</span> &nbsp;<span class="word">That being said…</span></p><p style="margin-top:7px">Use linking phrases when they help your meaning. A pause to think is more natural than forcing a transition into every sentence.</p></div>'+
      '<div class="activity" data-quiz="part3"><div class="activity-head"><h3>Build a more developed answer</h3><span class="activity-label">IDEA IN ACTION</span></div><p class="question">Question: “Do you think people spend enough time outdoors?” You’ve shared your opinion. What would best develop it?</p><div class="options"><button class="option" data-correct="false"><span class="option-letter">A</span>Repeat the same opinion using a longer phrase.</button><button class="option" data-correct="true"><span class="option-letter">B</span>Explain why, then offer a relevant example or consequence.</button><button class="option" data-correct="false"><span class="option-letter">C</span>List several unrelated facts to make your answer longer.</button></div><div class="feedback" role="status"></div></div>'+completionButton(topic.id);
  }
  function grammar(topic) {
    return sectionHead(topic,"GRAMMAR · FLEXIBLE, CLEAR SENTENCES","Show the range of your English with structures you can use comfortably. Accuracy and meaning always come first.")+
      '<div class="concept-card"><p class="concept-kicker">A small change, a richer answer</p><h3>Connect ideas with a reason, a time or a contrast.</h3><p>You already use grammar every time you speak. Notice how a simple sentence can grow naturally when you add one useful detail.</p></div>'+
      '<div class="example-box"><p class="example-label">Because · give a reason</p><p>“I enjoy cycling <strong>because it gives me a chance to spend time outdoors</strong>.”</p></div>'+
      '<div class="example-box"><p class="example-label">Although · show a contrast</p><p>“<strong>Although I live in a busy area</strong>, there’s a quiet park just around the corner.”</p></div>'+
      '<div class="example-box"><p class="example-label">When · add a time or situation</p><p>“I usually listen to podcasts <strong>when I’m travelling to work</strong>.”</p></div>'+
      '<div class="concept-card"><p class="concept-kicker">Grammar reminder</p><p>Vary your sentences, but don’t force complexity. A correct simple sentence communicates more than a complicated one that obscures your idea.</p></div>'+
      '<div class="activity" data-quiz="grammar"><div class="activity-head"><h3>Choose the sentence that is clear and accurate</h3><span class="activity-label">GRAMMAR CHECK</span></div><p class="question">You want to say that a hobby helps you relax after work.</p><div class="options"><button class="option" data-correct="false"><span class="option-letter">A</span>I enjoy to paint because it make me relax after work.</button><button class="option" data-correct="true"><span class="option-letter">B</span>I enjoy painting because it helps me unwind after work.</button><button class="option" data-correct="false"><span class="option-letter">C</span>Although I enjoy painting because it helps me to relaxed.</button></div><div class="feedback" role="status"></div></div>'+completionButton(topic.id);
  }
  function vocabulary(topic) {
    const card = flashcards[state.flashIndex];
    return sectionHead(topic,"VOCABULARY · USEFUL WORDS, USED WELL","Learn phrases that fit familiar IELTS topics. Read the meaning and example, then try using one in your own sentence.")+
      '<div class="activity-head"><h3>Your speaking flashcards</h3><span class="activity-label">CARD '+(state.flashIndex+1)+' OF '+flashcards.length+'</span></div><div class="vocab-card"><div><div class="vocab-term">'+card.term+'</div><div class="vocab-type">'+card.type+'</div><div class="vocab-meaning"><strong>Meaning:</strong> '+card.meaning+'<br><strong>Example:</strong> “'+card.example+'”</div></div></div>'+
      '<div class="vocab-controls"><button class="small-button secondary" id="flashPrev">← Previous</button><button class="small-button" id="flashNext">Next phrase →</button></div>'+
      '<div class="concept-card" style="margin-top:13px"><p class="concept-kicker">Make it yours</p><h3>Complete the sentence with a phrase from the card.</h3><p>“Learning to cook with my flatmates was a ______ from my normal routine.”</p></div>'+
      '<div class="activity"><div class="activity-head"><h3>Quick vocabulary practice</h3><span class="activity-label">TYPE YOUR ANSWER</span></div><div class="input-row"><input class="text-input" id="vocabAnswer" aria-label="Your vocabulary answer" placeholder="Type the phrase you would use"><button class="small-button" id="checkVocab">Check</button></div><div class="feedback" id="vocabFeedback" role="status"></div></div>'+
      '<div class="tip-card" style="margin-top:11px"><h3><span class="tip-icon">🌿</span>Use vocabulary naturally</h3><p>Choose words you understand and can pronounce comfortably. One precise phrase in the right place is more effective than a list of memorised “advanced” expressions.</p></div>'+completionButton(topic.id);
  }
  function studio(topic) {
    const savedNote = state.notes.studio || "";
    return sectionHead(topic,"SPEAKING PRACTICE · YOUR TURN","Bring your ideas together. Pick a prompt, make a quick plan, and write or speak your own answer out loud.")+
      '<div class="concept-card"><p class="concept-kicker">Today’s speaking prompt · Part 2</p><h3>Describe a skill you would like to learn.</h3><p>You should say what the skill is · how you would learn it · why you are interested in it · and explain how it might be useful to you.</p></div>'+
      '<div class="definition-grid"><article class="definition"><span class="definition-icon">💭</span><h3>Think · 30 seconds</h3><p>Choose one real skill and recall a detail that makes the story yours.</p></article><article class="definition"><span class="definition-icon">🎤</span><h3>Speak · 1–2 minutes</h3><p>Use keywords, keep going, and connect ideas in your own words.</p></article></div>'+
      '<div class="activity"><div class="activity-head"><h3>Make a simple plan, then practise</h3><span class="activity-label">PRIVATE TO THIS BROWSER</span></div><p class="question">Write a few keywords or your first draft below. For speaking practice, read the prompt aloud and answer without reading your notes.</p><div class="template-tabs" id="templateTabs">'+Object.keys(templates).map((name)=>'<button class="template-tab '+(name===activeTemplate?"active":"")+'" data-template="'+name+'">'+name+'</button>').join("")+'</div><div class="template-result" id="templateResult"><h3>'+templates[activeTemplate].title+'</h3><p>'+templates[activeTemplate].text+'</p><button class="small-button" id="copyTemplate">Copy this template</button></div><label for="studioNotes" class="activity-label" style="display:block;margin:13px 0 6px">YOUR NOTES OR PRACTICE ANSWER</label><textarea class="answer-area" id="studioNotes" placeholder="Start with a few keywords…">'+escapeHtml(savedNote)+'</textarea><div class="course-meta"><span id="studioCount">0 words</span><span id="saveLabel">Saves as you write</span></div></div>'+
      '<div class="tip-card" style="margin-top:10px"><h3>✨ A gentle self-check</h3><p>Did you answer every part of the prompt? Did you explain one idea with a detail? Was your meaning easy to follow? Pick just one thing to improve next time.</p></div>'+completionButton(topic.id);
  }
  function showTopic(id) {
    const topic = topics.find((item)=>item.id===id);
    if (!topic) return;
    current = id;
    document.getElementById("breadcrumb").textContent = topic.title;
    document.querySelectorAll(".nav-button").forEach((button)=>button.classList.toggle("active",button.dataset.topic===id));
    let body = "";
    if (id==="foundations") body = foundations(topic);
    if (id==="part1") body = partOne(topic);
    if (id==="part2") body = partTwo(topic);
    if (id==="part3") body = partThree(topic);
    if (id==="grammar") body = grammar(topic);
    if (id==="vocabulary") body = vocabulary(topic);
    if (id==="studio") body = studio(topic);
    page.innerHTML = '<div class="content-grid"><section class="panel">'+body+'</section>'+lessonSide("You don’t need to sound perfect. Focus on one clear idea at a time, and let your examples come from real life.",["Understand the idea","Notice it in an example","Try a quick activity"])+'</div><div class="footer-note">Practise at your pace · Your notes and course progress stay in this browser.</div>';
    page.querySelectorAll("[data-topic]").forEach((button)=>button.addEventListener("click",()=>showTopic(button.dataset.topic)));
    wireActivity(id);
    updateProgress();
    document.getElementById("scrollArea").scrollTop=0;
  }
  function wireActivity(id) {
    const complete = document.getElementById("completeLesson");
    if (complete) complete.addEventListener("click",()=>{
      if (!state.completed.includes(id)) state.completed.push(id);
      saveProgress();
      showTopic(id);
      announce("Lesson complete — lovely work. Choose the next topic whenever you’re ready.");
    });
    page.querySelectorAll(".activity[data-quiz] .option").forEach((option)=>{
      option.addEventListener("click",()=>{
        const activity = option.closest(".activity");
        const feedback = activity.querySelector(".feedback");
        activity.querySelectorAll(".option").forEach((item)=>{item.disabled=true;item.classList.remove("selected");});
        option.classList.add(option.dataset.correct==="true"?"correct":"incorrect");
        feedback.className="feedback show "+(option.dataset.correct==="true"?"good":"try");
        feedback.textContent=option.dataset.correct==="true"?"That’s it! A reason and a specific example help your answer feel developed and easy to follow.":"Not quite. Look for the option that supports a clear, personal answer without forcing it.";
      });
    });
    const part1Tip = document.querySelector('[data-action="show-part1-tips"]');
    if (part1Tip) part1Tip.addEventListener("click",()=>{const target=document.getElementById("part1Tip");target.textContent="Tip: imagine you’re answering a friendly person, not reciting a prepared speech. One honest detail is enough.";});
    if (id==="part2") wirePartTwo();
    if (id==="vocabulary") wireVocabulary();
    if (id==="studio") wireStudio();
  }
  function wirePartTwo() {
    const notes=document.getElementById("practiceNotes");
    const wordCount=document.getElementById("wordCount");
    if (notes) {
      notes.value=state.notes.part2||"";
      const count=()=>{wordCount.textContent=(notes.value.trim()?notes.value.trim().split(/\s+/).length:0)+" words";state.notes.part2=notes.value;saveProgress();};
      notes.addEventListener("input",count);count();
    }
    const display=document.getElementById("timerDisplay");
    const renderTimer=()=>{display.textContent=String(Math.floor(secondsLeft/60)).padStart(2,"0")+":"+String(secondsLeft%60).padStart(2,"0");};
    document.getElementById("timerStart").addEventListener("click",(event)=>{
      if (timerId) {clearInterval(timerId);timerId=null;event.currentTarget.textContent="▶ Resume timer";return;}
      event.currentTarget.textContent="Ⅱ Pause timer";
      timerId=setInterval(()=>{secondsLeft-=1;renderTimer();if(secondsLeft<=0){clearInterval(timerId);timerId=null;secondsLeft=0;renderTimer();event.currentTarget.textContent="✓ Time to speak";announce("Your one-minute planning time is up. Take a breath and start speaking.");}},1000);
    });
    document.getElementById("timerReset").addEventListener("click",()=>{if(timerId)clearInterval(timerId);timerId=null;secondsLeft=60;renderTimer();document.getElementById("timerStart").textContent="▶ Start 1-minute prep";});
    const toggle=document.getElementById("modelToggle");
    toggle.addEventListener("click",()=>{const answer=document.getElementById("modelAnswer");const open=answer.classList.toggle("show");toggle.textContent=open?"Hide sample response ↑":"Read a sample response ↓";toggle.setAttribute("aria-expanded",String(open));});
  }
  function wireVocabulary() {
    document.getElementById("flashPrev").addEventListener("click",()=>{state.flashIndex=(state.flashIndex+flashcards.length-1)%flashcards.length;saveProgress();showTopic("vocabulary");});
    document.getElementById("flashNext").addEventListener("click",()=>{state.flashIndex=(state.flashIndex+1)%flashcards.length;saveProgress();showTopic("vocabulary");});
    const check=()=>{const input=document.getElementById("vocabAnswer");const feedback=document.getElementById("vocabFeedback");const answer=input.value.trim().toLowerCase();if(!answer){feedback.className="feedback show try";feedback.textContent="Type your answer first, then check it.";return;}const isCorrect=["a welcome change of pace","welcome change of pace"].includes(answer);feedback.className="feedback show "+(isCorrect?"good":"try");feedback.textContent=isCorrect?"Exactly! “A welcome change of pace” fits the sentence naturally.":"Not quite. The phrase means a pleasant difference from your normal routine. Have another look at the flashcard.";};
    document.getElementById("checkVocab").addEventListener("click",check);
    document.getElementById("vocabAnswer").addEventListener("keydown",(event)=>{if(event.key==="Enter")check();});
  }
  function wireStudio() {
    const tabs=document.getElementById("templateTabs");
    tabs.addEventListener("click",(event)=>{const button=event.target.closest("[data-template]");if(!button)return;activeTemplate=button.dataset.template;tabs.querySelectorAll(".template-tab").forEach((tab)=>tab.classList.toggle("active",tab===button));const template=templates[activeTemplate];document.getElementById("templateResult").innerHTML="<h3>"+template.title+"</h3><p>"+template.text+"</p><button class=\"small-button\" id=\"copyTemplate\">Copy this template</button>";wireCopy();});
    const input=document.getElementById("studioNotes");
    const count=document.getElementById("studioCount");
    const saveLabel=document.getElementById("saveLabel");
    const update=()=>{const words=input.value.trim()?input.value.trim().split(/\s+/).length:0;count.textContent=words+" words";state.notes.studio=input.value;saveProgress();saveLabel.textContent="Saved in this browser";};
    input.addEventListener("input",update);update();
    wireCopy();
  }
  function wireCopy() {
    const button=document.getElementById("copyTemplate");
    if (!button) return;
    button.addEventListener("click",async()=>{
      try {await navigator.clipboard.writeText(templates[activeTemplate].text);announce("Template copied. Make it your own with details from your life.");}
      catch (error) {console.error("Unable to copy the speaking template.",error);announce("Clipboard access is unavailable here. You can select and copy the template text.");}
    });
  }
  renderNav();
  renderHome();
  page.addEventListener("click",(event)=>{const button=event.target.closest("[data-topic]");if(button)showTopic(button.dataset.topic);});
  document.getElementById("helpButton").addEventListener("click",()=>announce("Quick tip: pause for a moment to plan your next idea. Natural, clear answers matter more than memorised scripts."));
  updateProgress();
})();
</script>
</body>
</html>`;

export function SmartLesson() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [documentSource] = useState(() => {
    const fallback: LessonProgress = { completed: [], flashIndex: 0, notes: {} }
    let progress = fallback
    try {
      const stored = localStorage.getItem(PROGRESS_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (isLessonProgress(parsed)) {
          progress = parsed
        } else {
          throw new Error('Saved lesson progress has an unexpected format.')
        }
      }
    } catch (error) {
      console.error('Unable to load smart lesson progress.', error)
    }
    return smartLessonDocument.replace('__SMART_LESSON_PROGRESS__', JSON.stringify(progress))
  })

  useEffect(() => {
    function saveLessonProgress(event: MessageEvent<unknown>) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (typeof event.data !== 'object' || event.data === null || !('type' in event.data) || event.data.type !== 'speakia:lesson-progress') return
      if (!('progress' in event.data) || !isLessonProgress(event.data.progress)) {
        console.error('The smart lesson sent invalid progress data.')
        return
      }
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(event.data.progress))
      } catch (error) {
        console.error('Unable to save smart lesson progress.', error)
      }
    }
    window.addEventListener('message', saveLessonProgress)
    return () => window.removeEventListener('message', saveLessonProgress)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      title="Smart lesson — interactive IELTS speaking course"
      srcDoc={documentSource}
      sandbox="allow-scripts"
      allow="clipboard-write"
      referrerPolicy="no-referrer"
      style={{
        display: 'block',
        width: '100%',
        height: 'calc(100dvh - 67px)',
        minHeight: 0,
        border: 0,
        background: '#f7f8fc',
      }}
    />
  )
}
