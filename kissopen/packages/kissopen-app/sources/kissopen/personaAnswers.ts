import type { Persona, PersonaUpdate } from './api/types';

/*
 * The identity questions asked once after signing in, as plain data: the
 * choices offered and how the answers become what the server keeps. The
 * values are the desktop's own Chinese labels, so the home page and every
 * client read the same words whatever language the phone shows; `label`
 * names the translation shown for each.
 */

export type PersonaRole = '' | 'individual' | 'manager' | 'owner' | 'student';

export type PersonaAnswers = {
    readonly industry: string;
    readonly occupation: string;
    readonly role: PersonaRole;
    readonly teamSize: number;
    readonly goals: readonly string[];
};

export const PERSONA_GOALS_MAX = 3;
export const PERSONA_TEXT_MAX = 30;
/** The team size a leading role starts with, before one is chosen. */
const TEAM_SIZE_DEFAULT = 10;

export const PERSONA_INDUSTRIES = [
    { value: '海外电商', label: 'kissopen.persona.industryOverseasEcommerce' },
    { value: '国内电商', label: 'kissopen.persona.industryDomesticEcommerce' },
    { value: '外贸', label: 'kissopen.persona.industryForeignTrade' },
    { value: '制造业', label: 'kissopen.persona.industryManufacturing' },
    { value: '教育', label: 'kissopen.persona.industryEducation' },
    { value: '金融', label: 'kissopen.persona.industryFinance' },
    { value: '互联网', label: 'kissopen.persona.industryInternet' },
    { value: '医疗健康', label: 'kissopen.persona.industryHealthcare' },
    { value: '餐饮零售', label: 'kissopen.persona.industryFoodRetail' },
    { value: '专业服务', label: 'kissopen.persona.industryProfessionalServices' },
] as const;

export const PERSONA_OCCUPATIONS = [
    { value: '运营', label: 'kissopen.persona.occupationOperations' },
    { value: '市场营销', label: 'kissopen.persona.occupationMarketing' },
    { value: '销售', label: 'kissopen.persona.occupationSales' },
    { value: '客服', label: 'kissopen.persona.occupationSupport' },
    { value: '财务', label: 'kissopen.persona.occupationFinance' },
    { value: '人事', label: 'kissopen.persona.occupationHr' },
    { value: '行政文员', label: 'kissopen.persona.occupationAdmin' },
    { value: '产品设计', label: 'kissopen.persona.occupationProductDesign' },
    { value: '采购供应链', label: 'kissopen.persona.occupationSupplyChain' },
    { value: '老师', label: 'kissopen.persona.occupationTeacher' },
    { value: '程序员', label: 'kissopen.persona.occupationProgrammer' },
] as const;

export const PERSONA_ROLES = [
    { value: 'individual', title: 'kissopen.persona.roleIndividual', detail: 'kissopen.persona.roleIndividualDetail' },
    { value: 'manager', title: 'kissopen.persona.roleManager', detail: 'kissopen.persona.roleManagerDetail' },
    { value: 'owner', title: 'kissopen.persona.roleOwner', detail: 'kissopen.persona.roleOwnerDetail' },
    { value: 'student', title: 'kissopen.persona.roleStudent', detail: 'kissopen.persona.roleStudentDetail' },
] as const;

export const PERSONA_TEAM_SIZES = [
    { value: 5, label: 'kissopen.persona.team5' },
    { value: 10, label: 'kissopen.persona.team10' },
    { value: 30, label: 'kissopen.persona.team30' },
    { value: 50, label: 'kissopen.persona.team50' },
] as const;

export const PERSONA_GOALS = [
    { value: '写文档和报告', label: 'kissopen.persona.goalDocuments' },
    { value: '整理表格数据', label: 'kissopen.persona.goalSpreadsheets' },
    { value: '做 PPT', label: 'kissopen.persona.goalSlides' },
    { value: '回复邮件消息', label: 'kissopen.persona.goalReplies' },
    { value: '读长文件并总结', label: 'kissopen.persona.goalSummaries' },
    { value: '分析业务数据', label: 'kissopen.persona.goalAnalysis' },
    { value: '翻译', label: 'kissopen.persona.goalTranslation' },
    { value: '提醒和定时做事', label: 'kissopen.persona.goalReminders' },
    { value: '查资料', label: 'kissopen.persona.goalResearch' },
    { value: '做图片', label: 'kissopen.persona.goalImages' },
] as const;

const ROLES: readonly PersonaRole[] = ['', 'individual', 'manager', 'owner', 'student'];

export const personaAnswersEmpty: PersonaAnswers = { industry: '', occupation: '', role: '', teamSize: 0, goals: [] };

export function personaLeads(role: PersonaRole): boolean {
    return role === 'manager' || role === 'owner';
}

/** The answers kept on the account, to change them; a skipped questionnaire starts empty. */
export function personaAnswersOf(persona: Persona | null | undefined): PersonaAnswers {
    if (!persona || persona.skipped) return personaAnswersEmpty;
    const role = ROLES.includes(persona.role as PersonaRole) ? persona.role as PersonaRole : '';
    return {
        industry: persona.industry,
        occupation: persona.occupation,
        role,
        teamSize: personaLeads(role) ? persona.team_size : 0,
        goals: persona.goals.slice(0, PERSONA_GOALS_MAX),
    };
}

/** Choosing the chosen option again clears it: every question may be left. */
export function personaChoiceToggle(current: string, option: string): string {
    return current === option ? '' : option;
}

/** A role, and a team size to start from when it leads people and none was chosen. */
export function personaRoleChoose(answers: PersonaAnswers, role: PersonaRole): PersonaAnswers {
    return { ...answers, role, teamSize: personaLeads(role) && !answers.teamSize ? TEAM_SIZE_DEFAULT : answers.teamSize };
}

/** Adds or removes a goal; a fourth is not taken. */
export function personaGoalToggle(goals: readonly string[], goal: string): readonly string[] {
    if (goals.includes(goal)) return goals.filter((one) => one !== goal);
    return goals.length >= PERSONA_GOALS_MAX ? goals : [...goals, goal];
}

/** What the server is sent: the team size only counts for a role that leads people. */
export function personaUpdateOf(answers: PersonaAnswers, skipped: boolean): PersonaUpdate {
    return {
        industry: answers.industry.trim().slice(0, PERSONA_TEXT_MAX),
        occupation: answers.occupation.trim().slice(0, PERSONA_TEXT_MAX),
        role: answers.role,
        team_size: personaLeads(answers.role) ? answers.teamSize : 0,
        goals: answers.goals.slice(0, PERSONA_GOALS_MAX),
        skipped,
    };
}

/**
 * Which demonstration is wanted: the account's, as written from what it last
 * said about its work. None until the person has answered (or skipped) the
 * identity questions — the page is written from those answers.
 */
export function homeDemoKey(accountId: string | undefined, persona: Persona | null | undefined): string | undefined {
    if (!accountId || !persona) return undefined;
    return `${accountId}:${persona.updated}`;
}

/**
 * Whether the identity questions are still to be asked: the account has not
 * answered nor skipped them. An account kept by an older version of the app,
 * without the field at all, is not asked until `/me` says so.
 */
export function personaNeeded(user: { persona?: Persona | null } | undefined): boolean {
    return !!user && user.persona === null;
}
