$(function() {
    var alm_ = null;
    var ws_server_url = (window.location.protocol === 'http:' ? 'ws://' : 'wss://')
        + window.location.host
        + window.location.pathname.substr(0, window.location.pathname.lastIndexOf('/'))
        + '/ws';

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

                alm_ = WebRTCALM.create('simple', ws_server_url);
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
