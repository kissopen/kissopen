/** Scripts written without spaces between words, which break between any two characters. */
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/*
The part of a paragraph's last line that the trailing meta (the time, the copy
control) holds on to, and the text before it, which wraps freely.

In a spaced language that is the last word, so the meta never starts a line
alone. Chinese and Japanese have no spaces, so "the last word" was the whole
paragraph, held on one unbreakable line that ran off the side of the window;
there it is the last two characters, which keeps a closing 。 from starting a
line of its own. The renderer and the row-height estimate both split here, so
the height a row is given is the height it is drawn at.
*/
export function messageTrailingSplit(text: string): { head: string; tail: string } | undefined {
    const word = /^([\s\S]*?)(\S+)$/u.exec(text);
    if (!word) return undefined;
    const head = word[1] ?? "";
    const tail = word[2] ?? "";
    if (!UNSPACED_SCRIPT.test(tail)) return { head, tail };
    const characters = [...tail];
    const kept = Math.min(characters.length, 2);
    return {
        head: head + characters.slice(0, characters.length - kept).join(""),
        tail: characters.slice(characters.length - kept).join(""),
    };
}
