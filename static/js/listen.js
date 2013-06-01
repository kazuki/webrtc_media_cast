$(function() {
    var alm_ = null;
    var audioctx_ = null;
    var webAudioBufSize_ = 8192;
    var decoder_ = null;
    var ringBufferSizeInSec_ = 10;
    var ringBuffer_ = null;
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
        ringBuffer_ = new Float32Array(new ArrayBuffer(ringBufSamples * opus_channels_ * 4));

        decoder_ = new Worker("js/libopus.worker.js");
        decoder_.postMessage({'samplingrate': opus_sampling_rate_,
                              'channels': opus_channels_,
                              'float': true,
                              'type': 'decoder'});
        decoder_.onmessage = function(ev) {
            if (ev.data instanceof ArrayBuffer) {
                var f32ary = new Float32Array(ev.data);
                var modPos = ringWritePos_ % ringBuffer_.length;
                if (modPos + f32ary.length < ringBuffer_.length) {
                    ringBuffer_.set(f32ary, modPos);
                } else {
                    var tailSize = (ringBuffer_.length - modPos) * 4;
                    ringBuffer_.set(new Float32Array(ev.data.slice(0, tailSize)), modPos);
                    ringBuffer_.set(new Float32Array(ev.data.slice(tailSize)), 0);
                }
                ringWritePos_ += f32ary.length;
                if (ringWritePos_ - ringReadPos_ > ringBuffer_.length)
                    ringReadPos_ = ringWritePos_ - ringBuffer_.length;
                //console.log('decoded: ' + ev.data.byteLength + ' bytes');
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
            if (ringReadPos_ === 0 && ringWritePos_ < opus_sampling_rate_ * opus_channels_ * 5) {
                console.log('onaudioprocess. t=' + ev.playbackTime + ': buffering...  size=' + (ringWritePos_ - ringReadPos_) + '/' + ringBuffer_.length);
                return;
            }
            if (ringReadPos_ >= ringWritePos_) {
                console.log('onaudioprocess. t=' + ev.playbackTime + ': buffer underflow');
                return;
            }

            var outCh0 = ev.outputBuffer.getChannelData(0);
            var outCh1 = ev.outputBuffer.getChannelData(1);
            var samples = (ringWritePos_ - ringReadPos_ < outCh0.length * 2 ? ringWritePos_ - ringReadPos_ : outCh0.length * 2);
            var modReadPos = ringReadPos_ % ringBuffer_.length;
            var modEnd = (ringReadPos_ + samples) % ringBuffer_.length;
            var i = 0;
            if (modReadPos > modEnd) {
                for (var j = modReadPos; j < ringBuffer_.length; j += 2, i ++) {
                    outCh0[i] = ringBuffer_[j];
                    outCh1[i] = ringBuffer_[j + 1];
                }
                modReadPos = 0;
            }
            for (var j = modReadPos; i < modEnd; j += 2, i ++) {
                outCh0[i] = ringBuffer_[j];
                outCh1[i] = ringBuffer_[j + 1];
            }
            ringReadPos_ += samples;
            console.log('onaudioprocess. t=' + ev.playbackTime + ", samples=" + samples + ", ringbuf=" + (ringWritePos_ - ringReadPos_));
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
