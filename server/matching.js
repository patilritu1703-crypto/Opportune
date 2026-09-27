/**
 * OpporTune Matching Engine
 * ---------------------------------------------------------
 * A fully transparent, explainable scoring algorithm.
 * No external AI API required. Designed to be swapped out
 * later for an ML-based ranking model without touching the
 * rest of the codebase — just change what scoreOpportunity()
 * returns.
 *
 * matchScore = (skillMatch   * 0.40)
 *            + (interestMatch* 0.25)
 *            + (educationMatch*0.15)
 *            + (categoryMatch* 0.10)
 *            + (deadlineScore* 0.10)
 * ---------------------------------------------------------
 */

const norm = (s) => String(s || "").trim().toLowerCase();

function overlapRatio(userList = [], oppList = []) {
  if (!oppList.length) return { ratio: 0, matched: [] };
  const userSet = new Set(userList.map(norm));
  const matched = oppList.filter((o) => userSet.has(norm(o)));
  return {
    ratio: Math.min(1, matched.length / oppList.length),
    matched,
  };
}

function educationMatch(userEducation, oppEducationList = []) {
  const ue = norm(userEducation);
  if (!oppEducationList.length) return { score: 1, matched: true };
  if (oppEducationList.some((e) => norm(e) === "any")) {
    return { score: 1, matched: true };
  }
  const hit = oppEducationList.some((e) => {
    const oe = norm(e);
    return ue.includes(oe) || oe.includes(ue);
  });
  return { score: hit ? 1 : 0.2, matched: hit };
}

function daysUntil(deadline) {
  const now = new Date();
  const dl = new Date(deadline + "T23:59:59");
  const ms = dl.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function deadlineScoreFor(daysRemaining) {
  if (daysRemaining <= 0) return 1;
  if (daysRemaining <= 2) return 0.9;
  if (daysRemaining <= 5) return 0.75;
  if (daysRemaining <= 10) return 0.55;
  if (daysRemaining <= 21) return 0.35;
  return 0.15;
}

function urgencyLabel(daysRemaining) {
  if (daysRemaining <= 0) return { emoji: "🔴", label: "Closing today" };
  if (daysRemaining <= 2) return { emoji: "🟠", label: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left` };
  if (daysRemaining <= 5) return { emoji: "🟡", label: `${daysRemaining} days left` };
  if (daysRemaining < 10) return { emoji: "🟢", label: `${daysRemaining} days left` };
  return { emoji: "🟢", label: "10+ days left" };
}

/**
 * Score a single opportunity against a student profile.
 * profile: { education, skills[], interests[], categories[] }
 */
export function scoreOpportunity(profile, opp) {
  const skills = overlapRatio(profile.skills, opp.skills);
  const interests = overlapRatio(profile.interests, opp.interests);
  const edu = educationMatch(profile.education, opp.education);
  const categoryHit = (profile.categories || []).map(norm).includes(norm(opp.category));
  const daysRemaining = daysUntil(opp.deadline);
  const deadlineScore = deadlineScoreFor(daysRemaining);

  const matchScore = Math.round(
    skills.ratio * 40 +
      interests.ratio * 25 +
      edu.score * 15 +
      (categoryHit ? 1 : 0) * 10 +
      deadlineScore * 10
  );

  const reasons = [];
  if (skills.matched.length > 0) {
    reasons.push(`Matches your ${skills.matched.slice(0, 3).join(", ")} skill${skills.matched.length > 1 ? "s" : ""}`);
  }
  if (interests.matched.length > 0) {
    reasons.push(`Matches your ${interests.matched.slice(0, 2).join(", ")} interest${interests.matched.length > 1 ? "s" : ""}`);
  }
  if (edu.matched) {
    reasons.push("Suitable for your education background");
  }
  if (categoryHit) {
    reasons.push(`Matches your preferred category (${opp.category})`);
  }
  if (daysRemaining <= 5 && daysRemaining >= 0) {
    reasons.push("Deadline is approaching soon — apply now");
  }
  if (reasons.length === 0) {
    reasons.push("A broader opportunity outside your current profile — worth a look");
  }

  const urgency = urgencyLabel(daysRemaining);
  const breakdown = {
    skills: Math.round(skills.ratio * 40),
    interests: Math.round(interests.ratio * 25),
    education: Math.round(edu.score * 15),
    category: categoryHit ? 10 : 0,
    deadline: 0,
  };
  breakdown.deadline = Math.max(0, matchScore - breakdown.skills - breakdown.interests - breakdown.education - breakdown.category);
  const missingSkills = opp.skills.filter((skill) => !profile.skills.some((s) => norm(s) === norm(skill)));

  return {
    ...opp,
    matchScore,
    daysRemaining,
    urgency,
    matchedSkills: skills.matched,
    matchedInterests: interests.matched,
    missingSkills,
    breakdown,
    reasons,
  };
}

export function scoreAll(profile, opportunities) {
  return opportunities
    .map((o) => scoreOpportunity(profile, o))
    .sort((a, b) => b.matchScore - a.matchScore);
}

export { daysUntil, urgencyLabel };


/**
 * Find courses in the same catalog that can improve an opportunity's skill score.
 * The recommendation is deliberately self-referential: it uses the exact same
 * scoring engine to show the before/after match.
 */
export function recommendSkillGapCourses(profile, target, opportunities) {
  const baseline = scoreOpportunity(profile, target);
  const courses = opportunities.filter((o) => norm(o.category) === "course" && o.id !== target.id);

  return courses
    .map((course) => {
      const addedSkills = course.skills.filter((skill) =>
        target.skills.some((required) => norm(required) === norm(skill)) &&
        !profile.skills.some((owned) => norm(owned) === norm(skill))
      );
      if (!addedSkills.length) return null;

      const upgradedProfile = { ...profile, skills: [...new Set([...(profile.skills || []), ...course.skills])] };
      const upgraded = scoreOpportunity(upgradedProfile, target);
      const gain = upgraded.matchScore - baseline.matchScore;
      if (gain <= 0) return null;

      return {
        courseId: course.id,
        courseTitle: course.title,
        organization: course.organization,
        addedSkills,
        fromScore: baseline.matchScore,
        toScore: upgraded.matchScore,
        gain,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.gain - a.gain || b.addedSkills.length - a.addedSkills.length)
    .slice(0, 3);
}

export function addSkillGapRecommendations(profile, scored, opportunities) {
  return scored.map((item) => ({
    ...item,
    skillGapRecommendations: recommendSkillGapCourses(profile, item, opportunities),
  }));
}
