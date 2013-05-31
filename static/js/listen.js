$(function() {
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
            });
            $(c0).append(btn);
            $(c1).text(item.n);
            $(c2).text(item.d);
        });
        console.log(data);
    });
});
