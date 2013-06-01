$(function() {
    var alm_ = null;
    var audioctx_ = null;
    var webAudioBufSize_ = 8192;
    var decoder_ = null;
    var ringBufferSizeInSec_ = 10;
    var ringBuffers_ = [];
    var ringReadPos_ = 0, ringWritePos_ = 0;

    var play = function(id) {
        if (alm_ !== null) return;

        alm_ = WebRTCALM.create('simple', ws_server_url_);
        alm_.join(id, function() {
            console.log('connected');
        }, function(reason) {
            alert('err: ' + reason);
        });
        alm_.onmessage = function(data) {
            if (data instanceof ArrayBuffer) {
                decoder_.postMessage(data);
                return;
            }
        };

        var ringBufSamples = opus_sampling_rate_ * ringBufferSizeInSec_;
        if (ringBufSamples % opus_frame_size_ !== 0) ringBufSamples -= ringBufSamples % opus_frame_size_;
        for (var i = 0; i < opus_channels_; i++)
            ringBuffers_.push(new Float32Array(ringBufSamples * 4));

        decoder_ = new Worker("js/libopus.worker.js");
        decoder_.postMessage({'samplingrate': opus_sampling_rate_,
                              'channels': opus_channels_,
                              'float': true,
                              'deinterleave': true,
                              'type': 'decoder'});
        decoder_.onmessage = function(ev) {
            if (ev.data instanceof ArrayBuffer) {
                var f32ary = new Float32Array(ev.data);
                var samples_per_ch = f32ary.length / opus_channels_;
                var modPos = ringWritePos_ % ringBuffers_[0].length;
                if (modPos + samples_per_ch < ringBuffers_[0].length) {
                    for (var i = 0; i < opus_channels_; i ++)
                        ringBuffers_[i].set(f32ary.subarray(i * samples_per_ch, (i + 1) * samples_per_ch), modPos);
                } else {
                    var tailSize = (ringBuffers_[0].length - modPos);
                    for (var i = 0; i < opus_channels_; i ++) {
                        ringBuffers_[i].set(f32ary.subarray(i * samples_per_ch, i * samples_per_ch + tailSize), modPos);
                        ringBuffers_[i].set(f32ary.subarray(i * samples_per_ch + tailSize), 0);
                    }
                }
                ringWritePos_ += samples_per_ch;

                // TODO: 再生よりもデータ受信が早かった場合を考慮
                //if (ringWritePos_ - ringReadPos_ > ringBuffer_.length)
                //    ringReadPos_ = ringWritePos_ - ringBuffer_.length;
            }
        };

        try {
            audioctx_ = new AudioContext();
        } catch (e) {
            audioctx_ = new webkitAudioContext();
        }
        var proc_node = audioctx_.createScriptProcessor(webAudioBufSize_, 1, opus_channels_);
        var dummy_node = audioctx_.createBufferSource();
        
        dummy_node.buffer = audioctx_.createBuffer(1, opus_sampling_rate_ / 10, opus_sampling_rate_);
        dummy_node.loop = true;
        dummy_node.connect(proc_node);
        proc_node.connect(audioctx_.destination);
        proc_node.onaudioprocess = function(ev) {
            if (ringReadPos_ === 0 && ringWritePos_ < opus_sampling_rate_ * opus_channels_) {
                console.log('onaudioprocess. t=' + ev.playbackTime + ': buffering...  size=' + (ringWritePos_ - ringReadPos_) + '/' + ringBuffers_[0].length);
                return;
            }
            if (ringReadPos_ >= ringWritePos_) {
                console.log('onaudioprocess. t=' + ev.playbackTime + ': buffer underflow');
                return;
            }

            var outs = [];
            for (var i = 0; i < opus_channels_; i ++)
                outs.push(ev.outputBuffer.getChannelData(i));
            var samples = (ringWritePos_ - ringReadPos_ < outs[0].length ? ringWritePos_ - ringReadPos_ : outs[0].length);
            var modReadPos = ringReadPos_ % ringBuffers_[0].length;
            var modEnd = (ringReadPos_ + samples) % ringBuffers_[0].length;
            var idx = 0;
            if (modReadPos > modEnd) {
                for (var i = 0; i < opus_channels_; i ++)
                    outs[i].set(ringBuffers_[i].subarray(modReadPos), 0);
                idx += ringBuffers_[0].length - modReadPos;
                modReadPos = 0;
            }
            for (var i = 0; i < opus_channels_; i ++)
                outs[i].set(ringBuffers_[i].subarray(modReadPos, modEnd), idx);
            idx += (modEnd - modReadPos);
            ringReadPos_ += samples;
        };
        dummy_node.start(0);
    };

    $.getJSON('api/list', function(data) {
        var tbl = $('#programs tbody').get(0);
        data.forEach (function(item) {
            var row = tbl.insertRow(tbl.rows.length);
            var c0 = row.insertCell(0);
            var c1 = row.insertCell(1);
            var c2 = row.insertCell(2);
            var btn = $(document.createElement('button'));
            btn.text('play');
            btn.button({
                icons: {
                    primary: "ui-icon-play"
                },
                text: false
            }).click(function() {
                play(item.g);
            });
            $(c0).append(btn);
            $(c1).text(item.n);
            $(c2).text(item.d);
        });
    });
});
