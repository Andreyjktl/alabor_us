let stepper;

$(document).ready(function () {
    stepper = new Stepper($('#stepper')[0]);
    // Загрузка списка направлений
    getDirectionList();

    let schoolDataTable = $('#school-table').DataTable({
        language: {
            url: "http://cdn.datatables.net/plug-ins/9dcbecd42ad/i18n/Russian.json"
        },
        paging: false,
        scrollY: '300px',
        select: {
            style: 'multi',
            selector: 'td:last-child',
            info: false
        },
        ajax: {
            url: '../backend/program/getListDataTable.php',
            type: 'POST',
        },
        columns: [
            {data: 'building'},
            {
                data: 'name',
                render: function (data, type, row, meta) {
                    return '<button class="btn btn-link" data-toggle="modal" data-target="#programModal" data-id="' + row.id + '">' + data + '</button>';
                }
            },
            {data: 'direction'},
            {data: 'teacher'},
            {data: 'age'},
            {data: 'price'},
            {
                targets: 0,
                data: null,
                defaultContent: '',
                orderable: false,
                className: 'select-checkbox',
                width: '5%'
            }
        ],
        order: []
    });

    let schoolDataTableResult = $('#school-table-result').DataTable({
        language: {
            url: "http://cdn.datatables.net/plug-ins/9dcbecd42ad/i18n/Russian.json"
        },
        paging: false,
        searching: false,
        columns: [
            {data: 'name'},
            {data: 'direction'},
            {data: 'age'},
            {data: 'price'},
        ],
        order: []
    });

    let total = 0;
    let age = 'all';
    let direction = 'all';
    let programs = [];

    $('#school-age').on('change', function () {
        age = $(this).val();
        filterTables();
    });

    $('#school-direction').on('change', function () {
        direction = $(this).val();
        filterTables();
    });

    function filterTables() {
        schoolDataTable.draw();
        // Убираем лишние выбранные программы, которые не подходят по фильтрам
        schoolDataTableResult.clear();
        programs = [];
        $('#school-table tr.selected').each(function () {
            let selectedRowData = schoolDataTable.row($(this)).data();
            schoolDataTableResult.row.add(selectedRowData);
            programs.push(selectedRowData.id);
        });
        schoolDataTableResult.draw();
    }

    $('#school-table tbody').on('click', 'td.select-checkbox', function () {
        let row = $(this).closest('tr');
        let rowData = schoolDataTable.row(row).data();
        //Если кликнули и небыло класса "выбран"
        if (!row.hasClass('selected')) {
            schoolDataTableResult.row.add(rowData).draw();
            programs.push(rowData.id);
        } else {
            // Очищаем таблицу и добавляем только выбранные
            schoolDataTableResult.clear();
            programs = [];
            $('#school-table tr.selected').each(function () {
                if ($(this).index() !== row.index()) {
                    let selectedRowData = schoolDataTable.row($(this)).data();
                    schoolDataTableResult.row.add(selectedRowData);
                    programs.push(selectedRowData.id);
                }
            });
            schoolDataTableResult.draw();
        }

        total = schoolDataTableResult.column(schoolDataTableResult.columns().count() - 1).data().reduce((pv,cv)=>{
            return pv + (parseFloat(cv)||0);
        },0);
        $('#total').text(total);

        if (schoolDataTableResult.rows().count() !== 0) {
            $('.bs-stepper-pane.active > .btn-next').removeClass('d-none');
        } else {
            $('.bs-stepper-pane.active > .btn-next').addClass('d-none');
        }
    });

    $('.btn-prev').click(function () {
        $('#order-form input').prop('required', false);
        stepper.previous();
    });

    let previousTempalte = null;
    $('#goto-agreement').click(function () {
        let similarAge = true;
        let template = null;

        if (age !== 'all') {
            $('#school-table-result tbody tr').each(function () {
                let selectedRowData = schoolDataTableResult.row($(this)).data();
                let dataAge = selectedRowData['age'].split('-');
                let minAge = parseInt(dataAge[0]);
                let maxAge = parseInt(dataAge[1]);

                if (age < 14) {
                    template = 'form-less-14.html';
                    if (minAge >= 14) {
                        similarAge = false;
                        return;
                    }
                } else if (age >= 14 && age < 18) {
                    template = 'form-from-14-to-18.html';
                    if (maxAge > 18) {
                        similarAge = false;
                        return;
                    }
                } else {
                    template = 'form-greater-18.html';
                    if (minAge < 18 || maxAge < 18) {
                        similarAge = false;
                        return;
                    }
                }
            });
        } else {
            similarAge = false;
        }

        if (similarAge) {
            $.get(template, function (data) {
                $('#order-form input').prop('required', true);
                if (previousTempalte !== template) {
                    $('#form-by-age').html(data);
                }

                stepper.next();
                previousTempalte = template;
            });
        } else {
            alert('Вы выбрали программы, которые находятся в различных возрастных диапазонах. ' +
                '\nУкажите возраст обучающегося и выберите программы соответвующие возрасту');
        }
    });

    $('#order-form').submit(function (event) {
        event.preventDefault();
        let formData = $('#order-form').serializeArray();
        formData.push({'name' : 'program', 'value': JSON.stringify(programs)});
        $.ajax({
            url: '../backend/order/add.php',
            type: 'POST',
            data: formData,
            success: function (responseJSON) {
                let data = JSON.parse(responseJSON);
                if (data.status !== true) {
                    alert(data.message);
                    return;
                }

                $.ajax({
                    url: '../backend/agreement/generate.php',
                    type: 'POST',
                    data: {'ids' : JSON.stringify(data.ids)},
                    success: function (responseJSON) {
                        let data = JSON.parse(responseJSON);
                        if (data.status !== true) {
                            alert(data.message);
                            return;
                        }

                        window.open(data.zip,'_blank');
                        stepper.next();
                    }
                });
            }
        });
    });

    $('#programModal').on('show.bs.modal', function (e) {
        $.ajax({
            url: '../backend/program/get.php',
            type: 'POST',
            data: {'id': e.relatedTarget.dataset.id},
            success: function (responseJSON) {
                let data = JSON.parse(responseJSON)[0];
                
                for (let key of Object.keys(data)) {
                    if (key === 'direction') {
                        $('#program-modal-' + key).text(data[key].name);
                    } else if (key === 'teacher') {
                        let teachers = '';

                        if (data[key] !== '-') {
                            for (let teacher of data[key]) {
                                teachers += teacher.name + ', ';
                            }

                            teachers = teachers.slice(0, -2);
                        } else {
                            teachers = 'Преподаватели пока не выбраны';
                        }

                        $('#program-modal-' + key).text(teachers);
                    } else if (key === 'link') {
                        let template = 'Сведения о программе пока не добавлены';

                        if (data[key] !== '-') {
                            template = '<a href="' + data[key] + '" target="_blank">' +
                            '<img src="images/pdf-icon.png" class="icon">' +
                            '<span>Сведения о программе</span>' +
                            '</a>';
                        }

                        $('#program-modal-' + key).html(template);
                    } else if (key === 'rasp') {
                        let dayWeek = [
                            'Понедельник',
                            'Вторник',
                            'Среда',
                            'Четверг',
                            'Пятница',
                            'Суббота',
                            'Воскресенье'
                        ];
                        let weekSchedule = '<tr>';

                        $('#schedule tbody').empty();

                        for (let rasp of data[key]) {
                            weekSchedule += '<td>' + rasp.name + '</td>';

                            for (let i in rasp['week_schedule']) {
                                let activeClass = rasp['week_schedule'][i][dayWeek[i]]['start'] !== '' || rasp['week_schedule'][i][dayWeek[i]]['start'] !== '' ? 'rasp-active' : '';
                                weekSchedule += '<td class="' + activeClass + '">' + rasp['week_schedule'][i][dayWeek[i]]['start'] + '-<br>' + rasp['week_schedule'][i][dayWeek[i]]['end'] + '</td>';
                            }

                            weekSchedule += '</tr>';
                        }

                        $('#schedule tbody').append(weekSchedule);
                    } else if (key === 'building') {
                        let addresses = '';

                        for (let addr of data[key]) {
                            addresses += '<br>Корпус: ' + addr['name'] + ', ' + (addr['place'] === '' ? 'адрес временно отсутствует' : addr['place']) + '.';
                        }

                        $('#program-modal-place').html(addresses);
                    } else {
                        $('#program-modal-' + key).text(data[key]);
                    }
                }
            }
        });
    });
});

// Кастомные фильтры
$.fn.dataTable.ext.search.push(
    function (settings, data, dataIndex) {
        let ageFilterResult = false;
        let directionFilterResult = false;
        let age = $('#school-age').val();
        let direction = $('#school-direction').val();

        if (age === 'all') {
            ageFilterResult = true;
        } else {
            age = parseInt(age);
        }

        if (direction === 'all') {
            directionFilterResult = true;
        }

        let dataAge = data[4].split('-');
        let min = parseInt(dataAge[0]);
        let max = parseInt(dataAge[1]);

        if (age === 0 && ((min < 1 && !isNaN(min)) || (max < 1 && !isNaN(max)))) {
            ageFilterResult = true;
        }

        if (age === 18 && ((min >= 18 && !isNaN(min)) || (max >= 18 && !isNaN(max)))) {
            ageFilterResult = true;
        }

        if ((age >= min && !isNaN(min)) && (age <= max && !isNaN(max))) {
            ageFilterResult = true;
        }

        if (direction === data[2]) {
            directionFilterResult = true;
        }

        return (ageFilterResult && directionFilterResult);
    }
);

function getDirectionList() {
    $.ajax({
        url: '../backend/direction/getList.php',
        type: 'POST',
        success: function (responseJSON) {
            let response = JSON.parse(responseJSON);
            let select = $('#school-direction');
            let optionTemplate = '<option value="{{name}}">{{name}}</option>';

            for (let item of response) {
                let option = optionTemplate;

                for (let key of Object.keys(item)) {
                    option = option.split('{{' + key + '}}').join(item[key]);
                }

                select.append(option);
            }
        }
    });
}