$(function() {
    var alm_ = null;
    var filelist_ = [];
    var audioctx_ = null;
    var webAudioBufSize_ = 8192;
    var player_ = null;
    var player_cur_idx_ = -1;
    var player_status_ = 0; // 0=stop, 1=play
    var player_mute_ = true;
    var player_file_idx_ = 0;
    var player_file_pos_ = 0;
    var player_buffer_ = new Int16Array(new ArrayBuffer(webAudioBufSize_ * 2 * opus_channels_));
    var player_buffer_filled_ = 0;
    var encoder_ = null;
    var encoder_buffer_ = new ArrayBuffer(opus_frame_size_ * opus_channels_ * 2);
    var encoder_buffer_filled_ = 0;
    var opus_in_frame_bytes = opus_frame_size_ * opus_channels_ * 2;

    var check_player_file = function() {
        if (player_ && player_cur_idx_ == player_file_idx_) return;
        if (filelist_.length == 0) { player_ = null; return; }
        if (player_file_idx_ < 0) player_file_idx_ = 0;
        if (player_file_idx_ >= filelist_.length) player_file_idx_ = filelist_.length - 1;
        player_cur_idx_ = player_file_idx_;
        player_ = new RiffWaveReader(filelist_[player_cur_idx_], function() {
            if (player_.sampling_rate !== opus_sampling_rate_
                || player_.channels !== opus_channels_ || player_.bits_per_sample !== 16) { $('#ctrl-next').click(); return; }
            player_file_pos_ = 0;
            player_.read(player_file_pos_, webAudioBufSize_ * opus_channels_ * 2);
        });
        console.log("player::open. " + filelist_[player_cur_idx_].name);
        player_.onloadend = function(ev) {
            if (ev.target.readyState == FileReader.DONE) {
                console.log("player::onloadend");
                if (ev.target.result.byteLength == 0) {
                    player_file_pos_ = 0; // 無限リピート
                    player_.read(player_file_pos_, webAudioBufSize_ * opus_channels_ * 2);
                    return;
                    //console.log("EOF");
                    //return;
                }
                player_buffer_.set(new Int16Array(ev.target.result), player_buffer_filled_);
                player_buffer_filled_ += ev.target.result.byteLength / 2;
                player_file_pos_ += ev.target.result.byteLength;
            }
        };
    };

    $('#addFileList').click(function() {
        var lst = $('input#fileForm').get(0);
        var view = $('#file-list');
        for (var i = 0; i < lst.files.length; i ++) {
            filelist_.push(lst.files[i]);
            view.append($(document.createElement('option')).text(lst.files[i].name));
        }
    });

    $('#ctrl-prev').button({
        icons: {primary: 'ui-icon-seek-first'},
        text: false
    }).click(function() {
        if (player_file_idx_ > 0)
            player_file_idx_ -= 1;
    });
    $('#ctrl-play').button({
        icons: {primary: 'ui-icon-play'},
        text: false
    }).click(function() {
        player_status_ = 1;
        player_file_pos_ = 0;
    });
    $('#ctrl-pause').button({
        icons: {primary: 'ui-icon-pause'},
        text: false
    }).click(function() {
        player_status_ = 0;
    });
    $('#ctrl-stop').button({
        icons: {primary: 'ui-icon-stop'},
        text: false
    }).click(function() {
        player_status_ = 0;
        player_file_pos_ = 0;
    });
    $('#ctrl-next').button({
        icons: {primary: 'ui-icon-seek-end'},
        text: false
    }).click(function() {
        if (player_file_idx_ + 1 < filelist_.length)
            player_file_idx_ += 1;
    });

    $('#live-start-form').dialog({
        autoOpen: true,
        modal: true,
        closeOnEscape: false,
        buttons: {
            'Create': function() {
                var title = $('#title'), description = $('#description');
                if (title.val().length === 0) {
                    title.addClass('ui-state-error');
                    return;
                }
                title.removeClass('ui-state-error');
                $('#live-start-progress-bar').css('display', 'block');
                $('#live-start-progress').dialog('option', 'buttons', []);
                $('#live-start-progress p').text('Connecting...');
                $(this).dialog('close');
                $('#live-start-progress').dialog('open');

                alm_ = WebRTCALM.create('simple', ws_server_url_);
                alm_.create(title.val(), description.val(), function() {
                    $('#live-start-progress').dialog('close');
                }, function(reason) {
                    $('#live-start-progress p').text(reason);
                    $('#live-start-progress-bar').css('display', 'none');
                    $('#live-start-progress').dialog('option', 'buttons', [
                        {text: 'OK', click: function() {
                            $('#live-start-form').dialog('open');
                            $('#live-start-progress').dialog('close');
                        }}
                    ]);
                });

                encoder_ = new Worker("js/libopus.worker.js");
                encoder_.onmessage = function(ev) {
                    console.log('encoder::onmessage. ' + ev.data);
                    if (ev.data instanceof ArrayBuffer) {
                        if (alm_) alm_.multicast(ev.data);
                        console.log(ev.data.byteLength);
                    }
                };
                encoder_.postMessage({'samplingrate': opus_sampling_rate_,
                                      'channels': opus_channels_,
                                      'framesize': opus_frame_size_,
                                      'application': 'audio',
                                      'type': 'encoder'});
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
                    if (player_status_ !== 1) return;
                    console.log("audioctx::onaudioprocess");
                    check_player_file();
                    if (player_buffer_filled_ > 0) {
                        var outCh0 = ev.outputBuffer.getChannelData(0);
                        var outCh1 = ev.outputBuffer.getChannelData(1);
                        var inView = player_buffer_;
                        if (!player_mute_) {
                            for (var i = 0; i < player_buffer_.length; i += opus_channels_) {
                                outCh0[i>>1] = inView[i + 0] / 32768.0;
                                outCh1[i>>1] = inView[i + 1] / 32768.0;
                            }
                        }

                        var pbidx = 0;
                        if (encoder_buffer_filled_ > 0) {
                            var eview = new Int16Array(encoder_buffer_);
                            var size = opus_in_frame_bytes - encoder_buffer_filled_ * 2;
                            eview.set(player_buffer_.subarray(0, size / 2), encoder_buffer_filled_);
                            encoder_.postMessage(encoder_buffer_);
                            encoder_buffer_filled_ = 0;
                            pbidx += size / 2;
                        }
                        while (pbidx + opus_in_frame_bytes / 2 <= player_buffer_filled_) {
                            encoder_.postMessage(player_buffer_.buffer.slice(pbidx * 2, opus_in_frame_bytes));
                            pbidx += opus_in_frame_bytes / 2;
                        }
                        if (pbidx < player_buffer_filled_) {
                            var eview = new Int16Array(encoder_buffer_);
                            eview.set(player_buffer_.subarray(pbidx));
                            encoder_buffer_filled_ = player_buffer_filled_ - pbidx;
                        }

                        player_buffer_filled_ = 0;
                        player_.read(player_file_pos_, webAudioBufSize_ * opus_channels_ * 2);
                        console.log("audioctx::filled");
                    }
                };
            }
        },
        create: function(ev, ui) {
            $('#live-start-form').parent().find('button.ui-dialog-titlebar-close').remove();
        }
    });

    $('#live-start-progress-bar').progressbar({
        value: false
    });
    $('#live-start-progress').dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        create: function(ev, ui) {
            $('#live-start-form').parent().find('button.ui-dialog-titlebar-close').remove();
        }
    });
});
