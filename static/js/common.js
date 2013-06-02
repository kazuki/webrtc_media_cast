{
    var ua = window.navigator.userAgent;
    var supported = false;
    var pos = ua.indexOf("Firefox");
    if (pos >= 0) {
        var fx_ver = ua.substring(pos + 8, pos + 10) | 0;
        if (fx_ver >= 23)
            supported = true;
    }
    if (!supported) {
        window.location = window.location.protocol + '//' + window.location.host
            + window.location.pathname.substr(0, window.location.pathname.lastIndexOf('/'))
            + '/get_browser.xhtml';
    }
}

ws_server_url_ = (window.location.protocol === 'http:' ? 'ws://' : 'wss://')
    + window.location.host
    + window.location.pathname.substr(0, window.location.pathname.lastIndexOf('/'))
    + '/ws';

opus_sampling_rate_ = 48000;
opus_channels_ = 2;
opus_frame_size_ms_ = 20;
opus_frame_size_ = Math.floor(opus_sampling_rate_ * (opus_frame_size_ms_ / 1000));
