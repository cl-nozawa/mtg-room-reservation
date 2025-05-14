// ローカルストレージのキー
const STORAGE_KEY = 'roomReservations';

// 予約データを管理するクラス
class ReservationManager {
    constructor() {
        this.reservations = this.load_reservations();
    }

    // ローカルストレージから予約を読み込む
    load_reservations() {
        const storedData = localStorage.getItem(STORAGE_KEY);
        return storedData ? JSON.parse(storedData) : [];
    }

    // ローカルストレージに予約を保存する
    save_reservations() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reservations));
    }

    // 予約を追加する
    add_reservation(room, startDateTime, endDateTime, reserverName) {
        const newReservation = {
            id: Date.now(), // ユニークIDとして現在時刻のタイムスタンプを使用
            room,
            startDateTime,
            endDateTime,
            reserverName,
            createdAt: new Date().toISOString()
        };

        // 予約時間の重複チェック
        if (this.has_time_conflict(newReservation)) {
            return { success: false, message: '選択した時間帯は既に予約されています。' };
        }

        this.reservations.push(newReservation);
        this.save_reservations();
        return { success: true, reservation: newReservation };
    }

    // 予約時間が既存の予約と重複していないかチェック
    has_time_conflict(newReservation) {
        const { room, startDateTime, endDateTime } = newReservation;
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);

        // 同じ会議室の予約のみをチェック
        return this.reservations.some(reservation => {
            if (reservation.room !== room) return false;

            const existingStart = new Date(reservation.startDateTime);
            const existingEnd = new Date(reservation.endDateTime);

            // 時間の重複チェック
            return (
                (start >= existingStart && start < existingEnd) || // 新しい開始時間が既存の予約期間内
                (end > existingStart && end <= existingEnd) || // 新しい終了時間が既存の予約期間内
                (start <= existingStart && end >= existingEnd) // 新しい予約が既存の予約を包含
            );
        });
    }

    // 予約をCSV形式に変換
    generate_csv() {
        if (this.reservations.length === 0) {
            return null;
        }

        // CSVヘッダー
        const headers = ['会議室', '開始日時', '終了日時', '予約者名', '予約日時'];
        
        // データ行
        const rows = this.reservations.map(reservation => {
            return [
                `会議室${reservation.room}`,
                this.format_date_time(new Date(reservation.startDateTime)),
                this.format_date_time(new Date(reservation.endDateTime)),
                reservation.reserverName,
                this.format_date_time(new Date(reservation.createdAt))
            ];
        });

        // CSVデータの作成
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csvContent;
    }

    // 日時のフォーマット
    format_date_time(date) {
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 全ての予約を取得
    get_all_reservations() {
        return this.reservations;
    }
}

// 選択肢を生成する関数
function generate_date_options(selectElement, days = 30) {
    // 現在の日付
    const today = new Date();
    
    // 今日から指定日数分の選択肢を生成
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        const value = date.toISOString().split('T')[0]; // YYYY-MM-DD形式
        
        // 表示用の日付文字列
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekday = weekdays[date.getDay()];
        const label = `${month}月${day}日（${weekday}）`;
        
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        
        // 今日を選択状態にする
        if (i === 0) {
            option.selected = true;
        }
        
        selectElement.appendChild(option);
    }
}

// 30分単位の時間選択肢を生成する関数
function generate_time_options(selectElement, startHour = 9, endHour = 21) {
    for (let hour = startHour; hour <= endHour; hour++) {
        for (let minute of [0, 30]) {
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            selectElement.appendChild(option);
        }
    }
}

// 日付と時間から完全な日時文字列を作成
function create_datetime_string(dateStr, timeStr) {
    return `${dateStr}T${timeStr}:00`;
}

// 予約一覧表示を更新
function update_reservation_list(manager) {
    const container = document.getElementById('reservationListContainer');
    container.innerHTML = '';

    const reservations = manager.get_all_reservations();
    
    if (reservations.length === 0) {
        container.innerHTML = '<p class="no-reservations"><i class="fas fa-info-circle"></i> 予約はまだありません。</p>';
        return;
    }

    // 予約を日付順にソート
    const sortedReservations = [...reservations].sort((a, b) => 
        new Date(a.startDateTime) - new Date(b.startDateTime)
    );

    // 予約一覧を表示
    sortedReservations.forEach(reservation => {
        const item = document.createElement('div');
        item.className = `reservation-item room-${reservation.room.toLowerCase()}`;
        
        const start = new Date(reservation.startDateTime);
        const end = new Date(reservation.endDateTime);
        
        // 会議室のアイコンを設定
        const roomIcon = reservation.room === 'A' ? 'fa-tv' : 'fa-wifi';
        
        item.innerHTML = `
            <p><i class="fas fa-building"></i> <strong>会議室${reservation.room}</strong></p>
            <p><i class="fas fa-clock"></i> ${manager.format_date_time(start)} 〜 ${manager.format_date_time(end)}</p>
            <p><i class="fas fa-user"></i> ${reservation.reserverName}</p>
        `;
        
        container.appendChild(item);
    });
}

// CSVファイルとしてダウンロード
function download_csv(manager) {
    const csvContent = manager.generate_csv();
    
    if (!csvContent) {
        show_notification('ダウンロードできる予約データがありません。', 'error');
        return;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `会議室予約_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    show_notification('CSVファイルのダウンロードが完了しました。', 'success');
}

// 通知を表示する関数
function show_notification(message, type = 'info') {
    // 既存の通知を削除
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 新しい通知を作成
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // タイプに応じたアイコンを設定
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    
    notification.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    
    // bodyの先頭に追加
    document.body.insertBefore(notification, document.body.firstChild);
    
    // 3秒後に非表示
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// DOMの準備ができたら実行
document.addEventListener('DOMContentLoaded', () => {
    const reservationManager = new ReservationManager();
    const roomCards = document.querySelectorAll('.room-card');
    const roomSelect = document.getElementById('roomSelect');
    const reservationForm = document.getElementById('reservationForm');
    const downloadButton = document.getElementById('downloadCSV');
    
    // 日付と時間の選択要素
    const startDateSelect = document.getElementById('startDateSelect');
    const startTimeSelect = document.getElementById('startTimeSelect');
    const endDateSelect = document.getElementById('endDateSelect');
    const endTimeSelect = document.getElementById('endTimeSelect');

    // 日付選択肢を生成
    generate_date_options(startDateSelect);
    generate_date_options(endDateSelect);
    
    // 時間選択肢を生成（営業時間を9:00～21:00と仮定）
    generate_time_options(startTimeSelect);
    generate_time_options(endTimeSelect);
    
    // デフォルト値の設定
    const now = new Date();
    const roundedMinutes = Math.ceil(now.getMinutes() / 30) * 30;
    const startTime = new Date(now);
    
    if (roundedMinutes === 60) {
        startTime.setHours(now.getHours() + 1);
        startTime.setMinutes(0);
    } else {
        startTime.setMinutes(roundedMinutes);
    }
    
    // 開始時間のデフォルト値を設定
    const defaultStartHour = startTime.getHours().toString().padStart(2, '0');
    const defaultStartMinute = startTime.getMinutes().toString().padStart(2, '0');
    const defaultStartTimeStr = `${defaultStartHour}:${defaultStartMinute}`;
    
    // 終了時間は開始時間の1時間後を設定
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    const defaultEndHour = endTime.getHours().toString().padStart(2, '0');
    const defaultEndMinute = endTime.getMinutes().toString().padStart(2, '0');
    const defaultEndTimeStr = `${defaultEndHour}:${defaultEndMinute}`;
    
    // 選択肢がロードされた後にデフォルト値を設定
    setTimeout(() => {
        // 最も近い選択肢を選択
        set_closest_time_option(startTimeSelect, defaultStartTimeStr);
        set_closest_time_option(endTimeSelect, defaultEndTimeStr);
    }, 0);
    
    // 最も近い時間オプションを選択
    function set_closest_time_option(selectElement, timeStr) {
        const options = Array.from(selectElement.options);
        let bestMatchIndex = 0;
        let minDiff = Infinity;
        
        // 時間文字列を分単位に変換
        const targetMinutes = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
        
        options.forEach((option, index) => {
            if (option.value) {
                const optionMinutes = parseInt(option.value.split(':')[0]) * 60 + parseInt(option.value.split(':')[1]);
                const diff = Math.abs(optionMinutes - targetMinutes);
                
                if (diff < minDiff) {
                    minDiff = diff;
                    bestMatchIndex = index;
                }
            }
        });
        
        selectElement.selectedIndex = bestMatchIndex;
    }

    // 予約一覧を表示
    update_reservation_list(reservationManager);

    // 会議室カードのクリックイベント
    roomCards.forEach(card => {
        card.addEventListener('click', () => {
            // 選択状態のクラスを切り替え
            roomCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            // セレクトボックスの値を更新
            const roomId = card.dataset.room;
            roomSelect.value = roomId;
        });
    });

    // セレクトボックスの変更イベント
    roomSelect.addEventListener('change', () => {
        // カードの選択状態を更新
        roomCards.forEach(card => {
            card.classList.toggle('selected', card.dataset.room === roomSelect.value);
        });
    });

    // 予約フォームの送信イベント
    reservationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const room = roomSelect.value;
        const startDate = startDateSelect.value;
        const startTime = startTimeSelect.value;
        const endDate = endDateSelect.value;
        const endTime = endTimeSelect.value;
        const reserverName = document.getElementById('reserverName').value;
        
        // 日付と時間を組み合わせてISO文字列に変換
        const startDateTime = create_datetime_string(startDate, startTime);
        const endDateTime = create_datetime_string(endDate, endTime);
        
        // 入力チェック
        if (!room) {
            show_notification('会議室を選択してください。', 'error');
            return;
        }
        
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);
        
        if (start >= end) {
            show_notification('終了時間は開始時間よりも後に設定してください。', 'error');
            return;
        }

        // 予約を追加
        const result = reservationManager.add_reservation(room, startDateTime, endDateTime, reserverName);
        
        if (result.success) {
            show_notification('予約が完了しました！', 'success');
            
            // フォームをリセット（セレクトは初期値を保持）
            document.getElementById('reserverName').value = '';
            roomSelect.value = '';
            roomCards.forEach(c => c.classList.remove('selected'));
            
            // 予約一覧を更新
            update_reservation_list(reservationManager);
        } else {
            show_notification(result.message, 'error');
        }
    });

    // CSVダウンロードボタンのクリックイベント
    downloadButton.addEventListener('click', () => {
        download_csv(reservationManager);
    });
}); 