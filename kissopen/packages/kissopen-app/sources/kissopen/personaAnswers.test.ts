import { describe, expect, it } from 'vitest';
import type { Persona } from './api/types';
import {
    PERSONA_GOALS,
    PERSONA_INDUSTRIES,
    PERSONA_OCCUPATIONS,
    homeDemoKey,
    personaAnswersEmpty,
    personaAnswersOf,
    personaChoiceToggle,
    personaGoalToggle,
    personaNeeded,
    personaRoleChoose,
    personaUpdateOf,
} from './personaAnswers';

const persona = (fields: Partial<Persona> = {}): Persona => ({
    industry: '外贸', occupation: '销售', role: 'manager', team_size: 30,
    goals: ['翻译', '查资料'], skipped: false, updated: 100, ...fields,
});

describe('persona options', () => {
    it('sends the desktop\'s own Chinese labels as values', () => {
        expect(PERSONA_INDUSTRIES.map(option => option.value)).toEqual(['海外电商', '国内电商', '外贸', '制造业', '教育', '金融', '互联网', '医疗健康', '餐饮零售', '专业服务']);
        expect(PERSONA_OCCUPATIONS.map(option => option.value)).toEqual(['运营', '市场营销', '销售', '客服', '财务', '人事', '行政文员', '产品设计', '采购供应链', '老师', '程序员']);
        expect(PERSONA_GOALS.map(option => option.value)).toEqual(['写文档和报告', '整理表格数据', '做 PPT', '回复邮件消息', '读长文件并总结', '分析业务数据', '翻译', '提醒和定时做事', '查资料', '做图片']);
    });
});

describe('answers', () => {
    it('clears a choice chosen again', () => {
        expect(personaChoiceToggle('', '外贸')).toBe('外贸');
        expect(personaChoiceToggle('外贸', '外贸')).toBe('');
        expect(personaChoiceToggle('外贸', '金融')).toBe('金融');
    });

    it('starts a leading role at ten people and keeps a size already chosen', () => {
        expect(personaRoleChoose(personaAnswersEmpty, 'manager').teamSize).toBe(10);
        expect(personaRoleChoose(personaAnswersEmpty, 'owner').teamSize).toBe(10);
        expect(personaRoleChoose(personaAnswersEmpty, 'individual').teamSize).toBe(0);
        expect(personaRoleChoose({ ...personaAnswersEmpty, teamSize: 50 }, 'manager').teamSize).toBe(50);
    });

    it('takes at most three goals and gives one back when chosen again', () => {
        let goals: readonly string[] = [];
        for (const goal of ['翻译', '查资料', '做图片', '做 PPT']) goals = personaGoalToggle(goals, goal);
        expect(goals).toEqual(['翻译', '查资料', '做图片']);
        expect(personaGoalToggle(goals, '查资料')).toEqual(['翻译', '做图片']);
    });
});

describe('the update sent', () => {
    it('sends team size only for a role that leads people', () => {
        const answers = { industry: '外贸', occupation: '销售', role: 'individual' as const, teamSize: 30, goals: ['翻译'] };
        expect(personaUpdateOf(answers, false)).toEqual({ industry: '外贸', occupation: '销售', role: 'individual', team_size: 0, goals: ['翻译'], skipped: false });
        expect(personaUpdateOf({ ...answers, role: 'owner' }, false).team_size).toBe(30);
    });

    it('keeps the answers so far when skipping', () => {
        expect(personaUpdateOf({ ...personaAnswersEmpty, industry: '教育' }, true)).toEqual({ industry: '教育', occupation: '', role: '', team_size: 0, goals: [], skipped: true });
    });

    it('sends free text as typed, trimmed to the server limit', () => {
        const update = personaUpdateOf({ ...personaAnswersEmpty, industry: '  跨境物流  ', occupation: 'x'.repeat(40) }, false);
        expect(update.industry).toBe('跨境物流');
        expect(update.occupation).toHaveLength(30);
    });
});

describe('answers kept', () => {
    it('start the questions again', () => {
        expect(personaAnswersOf(persona())).toEqual({ industry: '外贸', occupation: '销售', role: 'manager', teamSize: 30, goals: ['翻译', '查资料'] });
    });

    it('start empty when skipped or never answered', () => {
        expect(personaAnswersOf(persona({ skipped: true }))).toEqual(personaAnswersEmpty);
        expect(personaAnswersOf(null)).toEqual(personaAnswersEmpty);
        expect(personaAnswersOf(undefined)).toEqual(personaAnswersEmpty);
    });

    it('drop a role the questions do not offer and goals past three', () => {
        const answers = personaAnswersOf(persona({ role: 'ceo', goals: ['翻译', '查资料', '做图片', '做 PPT', '分析业务数据'] }));
        expect(answers.role).toBe('');
        expect(answers.teamSize).toBe(0);
        expect(answers.goals).toEqual(['翻译', '查资料', '做图片']);
    });
});

describe('asking and the home page', () => {
    it('asks only an account whose persona is null', () => {
        expect(personaNeeded({ persona: null })).toBe(true);
        expect(personaNeeded({ persona: persona() })).toBe(false);
        expect(personaNeeded({ persona: persona({ skipped: true }) })).toBe(false);
        expect(personaNeeded({})).toBe(false);
        expect(personaNeeded(undefined)).toBe(false);
    });

    it('wants no home page before the persona, and a new one after it changes', () => {
        expect(homeDemoKey('u1', null)).toBeUndefined();
        expect(homeDemoKey(undefined, persona())).toBeUndefined();
        expect(homeDemoKey('u1', persona())).toBe('u1:100');
        expect(homeDemoKey('u1', persona({ updated: 200 }))).not.toBe(homeDemoKey('u1', persona()));
    });
});
