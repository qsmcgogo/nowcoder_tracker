const $ = require('@ncfe/nc.jquery');
const Vue = require('@ncfe/nc.vue');
const MathJax = require('@ncfe/nc.mathJax');
const Html = require('@ncfe/nc.html');
const Time = require('@ncfe/nc.time');
import store, {UPDATE_EDITOR_WIDTH, UPDATE_EDITOR_HEIGHT} from './store';
import FullLeft from './cpn/fullLeft';
import Workbench from './module/workbench';
import WorkbenchMonaco from './module/workbenchMonaco';
import Vertical from './separator/vertical';

export default {
    init: fInit,
    initResize: fInitResize,
    initFullLeft: fInitFullLeft,
    initCopy: fInitCopy,
    initWorkbench: fInitWorkbench,
    initVerticalSeparator: fInitVerticalSeparator
};

function fInit() {
    const that = this;
    const oLeftEl = (that.leftEl = $('.js-left'));
    MathJax.image(oLeftEl);
    MathJax.form(oLeftEl);

    that.initResize();
    that.initFullLeft();
    that.initCopy();
    that.initWorkbench();
    that.initVerticalSeparator();

    setTimeout(() => $(window).scrollTop(0), 2000);
}

function fInitResize() {
    const that = this;
    const oContentEl = $('div.content-board');
    oContentEl.addClass('nc-el-container');
    const oBodyEl = $('body');
    oBodyEl.addClass('tw-overflow-hidden');
    const oWin = $(window);
    oContentEl.outerHeight(oWin.height() - 50).outerWidth(oWin.width());
    const fFrequency = Time.frequency(50);
    oWin.on('resize', () =>
        fFrequency(() => {
            oContentEl.outerHeight(oWin.height() - 50).outerWidth(oWin.width());
            store.commit(UPDATE_EDITOR_WIDTH);
            store.commit(UPDATE_EDITOR_HEIGHT);
        })
    );
}

function fInitFullLeft() {
    const that = this;
    new Vue({
        el: '.js-full-question',
        store,
        render: h => h(FullLeft)
    });
}

function fInitCopy() {
    const that = this;
    Html.copy({
        el: that.leftEl,
        max: 50,
        dealContent: function (oEl, sContent, bHtml) {
            const aItem = [];
            const sHref = window.location.href;
            aItem.push('链接：' + (bHtml ? '<a target="_blank" href="' + sHref + '">' + sHref + '</a>' : sHref));
            aItem.push('来源：牛客网');
            aItem.push('');
            aItem.push(sContent);
            return aItem.join(bHtml ? '<br />' : '\n');
        }
    });
}

function fInitWorkbench() {
    const that = this;
    that.workbench = new Vue({
        el: '#jsCodeEditor',
        store,
        // render: h => h(Workbench)
        render: h => h(window.pageInfo.isNewJudgeEditor ? WorkbenchMonaco : Workbench)
    });
}

function fInitVerticalSeparator() {
    const that = this;
    new Vue({
        el: '#jsVerticalSeparator',
        store,
        render: h =>
            h(Vertical, {
                props: {
                    leftRef: that.leftEl.get(0),
                    rightRef: that.workbench.$el
                }
            })
    });
}
