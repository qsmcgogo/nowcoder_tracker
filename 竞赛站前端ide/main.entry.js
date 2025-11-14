var Sys = require('@ncfe/nc.sys');
import Common from '../common/index';

Sys.ready({
    initialize: fInitialize
});

function fInitialize() {
    var that = this;
    Common.init();
}
