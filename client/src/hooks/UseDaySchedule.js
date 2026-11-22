import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSchedule } from '../store/slices/scheduleSlice';

const EMPTY = [];

const useDaySchedule = (date) => {
    const dispatch = useDispatch();
    const day = useSelector((s) => (date ? s.schedule.byDate[date] : null));
    const failed = useSelector((s) => (date ? Boolean(s.schedule.errors[date]) : false));

    useEffect(() => {
        if (date && !day && !failed) dispatch(fetchSchedule(date));
    }, [dispatch, date, day, failed]);

    return day?.segments || EMPTY;
};

export default useDaySchedule;
