import StatusPage from '../../components/ui/StatusPage';

const ServerError = () => (
    <StatusPage code="500" title="Something went wrong" message="We couldn't finish that request. Your data is safe. Try again in a moment." />
);

export default ServerError;
