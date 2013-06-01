ws_server_url_ = (window.location.protocol === 'http:' ? 'ws://' : 'wss://')
    + window.location.host
    + window.location.pathname.substr(0, window.location.pathname.lastIndexOf('/'))
    + '/ws';

opus_sampling_rate_ = 48000;
opus_channels_ = 2;
opus_frame_size_ms_ = 20;
opus_frame_size_ = Math.floor(opus_sampling_rate_ * (opus_frame_size_ms_ / 1000));
