import produce from 'immer';
import { Image } from '@linode/api-v4/lib/images';
import { APIError } from '@linode/api-v4/lib/types';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import * as React from 'react';
import { connect, MapDispatchToProps } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { compose } from 'recompose';
import { AnyAction } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import ActionsPanel from 'src/components/ActionsPanel';
import AddNewLink from 'src/components/AddNewLink';
import Breadcrumb from 'src/components/Breadcrumb';
import Button from 'src/components/Button';
import CircleProgress from 'src/components/CircleProgress';
import ConfirmationDialog from 'src/components/ConfirmationDialog';
import Paper from 'src/components/core/Paper';
import { makeStyles, Theme } from 'src/components/core/styles';
import Typography from 'src/components/core/Typography';
import { DocumentTitleSegment } from 'src/components/DocumentTitle';
import EntityTable, {
  EntityTableRow,
  HeaderCell
} from 'src/components/EntityTable';
import EntityTable_CMR from 'src/components/EntityTable/EntityTable_CMR';
import ErrorState from 'src/components/ErrorState';
import Grid from 'src/components/Grid';
import LandingHeader from 'src/components/LandingHeader';
import Notice from 'src/components/Notice';
import Placeholder from 'src/components/Placeholder';
import useFlags from 'src/hooks/useFlags';
import useReduxLoad from 'src/hooks/useReduxLoad';
import { ApplicationState } from 'src/store';
import {
  deleteImage as _deleteImage,
  requestImages as _requestImages
} from 'src/store/image/image.requests';
import imageEvents from 'src/store/selectors/imageEvents';
import { getErrorStringOrDefault } from 'src/utilities/errorUtils';
import ImageRow, { ImageWithEvent } from './ImageRow';
import ImageRow_CMR from './ImageRow_CMR';
import { Handlers as ImageHandlers } from './ImagesActionMenu';
import ImagesDrawer, { DrawerMode } from './ImagesDrawer';
import { DeleteImagePayload } from 'src/store/image/image.actions';

const useStyles = makeStyles((theme: Theme) => ({
  root: {},
  title: {
    marginBottom: theme.spacing(1) + theme.spacing(1) / 2
  }
}));

interface ImageDrawerState {
  open: boolean;
  mode: DrawerMode;
  imageID?: string;
  label?: string;
  description?: string;
  selectedDisk: string | null;
  selectedLinode?: number;
}

interface ImageDialogState {
  open: boolean;
  submitting: boolean;
  image?: string;
  imageID?: string;
  error?: string;
}

type CombinedProps = ImageDispatch &
  ImageDrawerState &
  ImageDialogState &
  RouteComponentProps<{}> &
  WithPrivateImages &
  WithSnackbarProps;

const defaultDrawerState = {
  open: false,
  mode: 'edit' as DrawerMode,
  label: '',
  description: '',
  selectedDisk: null
};

const defaultDialogState = {
  open: false,
  submitting: false,
  image: '',
  imageID: '',
  error: undefined
};

export const ImagesLanding: React.FC<CombinedProps> = props => {
  const classes = useStyles();
  const flags = useFlags();

  useReduxLoad(['images']);

  const { imagesData, imagesLoading, imagesError, deleteImage } = props;

  const headers: HeaderCell[] = [
    {
      label: 'Image',
      dataColumn: 'label',
      sortable: true,
      widthPercent: 25
    },
    {
      label: 'Created',
      dataColumn: 'created',
      sortable: false,
      widthPercent: 25,
      hideOnMobile: flags.cmr
    },
    {
      label: 'Expires',
      dataColumn: 'expires',
      sortable: false,
      widthPercent: 15,
      hideOnMobile: flags.cmr
    },
    {
      label: 'Size',
      dataColumn: 'size',
      sortable: true,
      widthPercent: 25
    },
    {
      label: 'Action Menu',
      visuallyHidden: true,
      dataColumn: '',
      sortable: false,
      widthPercent: 5
    }
  ];

  const [drawer, setDrawer] = React.useState<ImageDrawerState>(
    defaultDrawerState
  );

  const [dialog, setDialogState] = React.useState<ImageDialogState>(
    defaultDialogState
  );

  const openDialog = (image: string, imageID: string) => {
    setDialogState({
      open: true,
      submitting: false,
      image,
      imageID,
      error: undefined
    });
  };

  const closeDialog = () => {
    setDialogState({ ...dialog, open: false });
  };

  const handleRemoveImage = () => {
    if (!dialog.imageID) {
      setDialogState(dialog => ({
        ...dialog,
        error: 'Image is not available.'
      }));
    }
    setDialogState(dialog => ({
      ...dialog,
      submitting: true,
      error: undefined
    }));

    deleteImage({ imageID: dialog.imageID! })
      .then(() => {
        closeDialog();
        /**
         * request generated by the Pagey HOC.
         *
         * We're making a request here because the image is being
         * optimistically deleted on the API side, so a GET to /images
         * will not return the image scheduled for deletion. This request
         * is ensuring the image is removed from the list, to prevent the user
         * from taking any action on the Image.
         */
        // this.props.onDelete();
        props.enqueueSnackbar('Image has been scheduled for deletion.', {
          variant: 'info'
        });
      })
      .catch(err => {
        const _error = getErrorStringOrDefault(
          err,
          'There was an error deleting the image.'
        );
        setDialogState(dialog => ({
          ...dialog,
          submitting: false,
          error: _error
        }));
      });
  };

  const openForCreate = () => {
    setDrawer({
      open: true,
      mode: 'create',
      label: '',
      description: '',
      selectedDisk: null
    });
  };

  const openForEdit = (label: string, description: string, imageID: string) => {
    setDrawer({
      open: true,
      mode: 'edit',
      description,
      imageID,
      label,
      selectedDisk: null
    });
  };

  const openForRestore = (imageID: string) => {
    setDrawer({
      open: true,
      mode: 'restore',
      imageID,
      selectedDisk: null
    });
  };

  const deployNewLinode = (imageID: string) => {
    const { history } = props;
    history.push({
      pathname: `/linodes/create/`,
      search: `?type=My%20Images&imageID=${imageID}`,
      state: { selectedImageId: imageID }
    });
  };

  const changeSelectedLinode = (linodeId: number | null) => {
    setDrawer(prevDrawerState => ({
      ...prevDrawerState,
      selectedDisk: null,
      selectedLinode: linodeId ?? undefined
    }));
  };

  const changeSelectedDisk = (disk: string | null) => {
    setDrawer(prevDrawerState => ({
      ...prevDrawerState,
      selectedDisk: disk
    }));
  };

  const setLabel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDrawer(prevDrawerState => ({
      ...prevDrawerState,
      label: e.target.value
    }));
  };

  const setDescription = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDrawer(prevDrawerState => ({
      ...prevDrawerState,
      description: e.target.value
    }));
  };

  const getActions = () => {
    return (
      <ActionsPanel>
        <Button buttonType="cancel" onClick={closeDialog} data-qa-cancel>
          Cancel
        </Button>
        <Button
          buttonType="secondary"
          destructive
          loading={dialog.submitting}
          onClick={handleRemoveImage}
          data-qa-submit
        >
          Confirm
        </Button>
      </ActionsPanel>
    );
  };

  const closeImageDrawer = () => {
    setDrawer(prevDrawerState => ({
      ...prevDrawerState,
      open: false
    }));
  };

  const renderImageDrawer = () => {
    return (
      <ImagesDrawer
        open={drawer.open}
        mode={drawer.mode}
        label={drawer.label}
        description={drawer.description}
        selectedDisk={drawer.selectedDisk}
        selectedLinode={drawer.selectedLinode || null}
        imageID={drawer.imageID}
        changeDisk={changeSelectedDisk}
        changeLinode={changeSelectedLinode}
        changeLabel={setLabel}
        changeDescription={setDescription}
        onClose={closeImageDrawer}
      />
    );
  };

  const Table = flags.cmr ? EntityTable_CMR : EntityTable;

  const handlers: ImageHandlers = {
    onRestore: openForRestore,
    onDeploy: deployNewLinode,
    onEdit: openForEdit,
    onDelete: openDialog
  };

  const imageRow: EntityTableRow<Image> = {
    Component: flags.cmr ? ImageRow_CMR : ImageRow,
    data: imagesData ?? [],
    loading: false,
    lastUpdated: 100,
    handlers
  };

  const renderError = (_: APIError[]) => {
    return (
      <React.Fragment>
        <DocumentTitleSegment segment="Images" />
        <ErrorState errorText="There was an error retrieving your images. Please reload and try again." />
      </React.Fragment>
    );
  };

  const renderLoading = () => {
    return <CircleProgress />;
  };

  const renderEmpty = () => {
    return (
      <React.Fragment>
        <DocumentTitleSegment segment="Images" />
        <Placeholder
          title="Add an Image"
          copy={<EmptyCopy />}
          buttonProps={[
            {
              onClick: openForCreate,
              children: 'Add an Image'
            }
          ]}
        />
        {renderImageDrawer()}
      </React.Fragment>
    );
  };

  if (imagesLoading) {
    return renderLoading();
  }

  /** Error State */
  if (imagesError) {
    return renderError(imagesError);
  }

  /** Empty State */
  if (!imagesData || imagesData.length === 0) {
    return renderEmpty();
  }

  return (
    <React.Fragment>
      {flags.cmr ? (
        <LandingHeader
          title="Images"
          entity="Image"
          onAddNew={openForCreate}
          docsLink="https://www.linode.com/docs/platform/disk-images/linode-images/"
        />
      ) : (
        <>
          <DocumentTitleSegment segment="Images" />
          <Grid
            container
            justify="space-between"
            alignItems="flex-end"
            updateFor={[classes]}
            style={{ paddingBottom: 0 }}
          >
            <Grid item>
              <Breadcrumb
                pathname={props.location.pathname}
                labelTitle="Images"
                className={classes.title}
              />
            </Grid>
            <Grid item>
              <Grid container alignItems="flex-end">
                <Grid item className="pt0">
                  <AddNewLink onClick={openForCreate} label="Add an Image" />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </>
      )}
      <Paper>
        <Table
          entity="image"
          groupByTag={false}
          row={imageRow}
          headers={headers}
        />
      </Paper>
      {renderImageDrawer()}
      <ConfirmationDialog
        open={dialog.open}
        title={`Remove ${dialog.image}`}
        onClose={closeDialog}
        actions={getActions}
      >
        {dialog.error && <Notice error text={dialog.error} />}
        <Typography>Are you sure you want to remove this image?</Typography>
      </ConfirmationDialog>
    </React.Fragment>
  );
};

const EmptyCopy = () => (
  <>
    <Typography variant="subtitle1">
      Adding an image is easy. Click here to
    </Typography>
    <Typography variant="subtitle1">
      <a
        href="https://linode.com/docs/platform/disk-images/linode-images-new-manager/"
        target="_blank"
        aria-describedby="external-site"
        rel="noopener noreferrer"
        className="h-u"
      >
        learn more about Images
      </a>
      &nbsp;or&nbsp;
      <a
        href="https://linode.com/docs/quick-answers/linode-platform/deploy-an-image-to-a-linode"
        target="_blank"
        aria-describedby="external-site"
        rel="noopener noreferrer"
        className="h-u"
      >
        deploy an Image to a Linode.
      </a>
    </Typography>
  </>
);
interface WithPrivateImages {
  imagesData: ImageWithEvent[];
  imagesLoading: boolean;
  imagesError?: APIError[];
  imagesLastUpdated: number;
}

interface ImageDispatch {
  deleteImage: (imageID: DeleteImagePayload) => Promise<{}>;
  requestImages: () => Promise<Image[]>;
}

const mapDispatchToProps: MapDispatchToProps<ImageDispatch, {}> = (
  dispatch: ThunkDispatch<ApplicationState, undefined, AnyAction>
) => ({
  deleteImage: (imageID: DeleteImagePayload) => dispatch(_deleteImage(imageID)),
  requestImages: () => dispatch(_requestImages())
});

const withPrivateImages = connect(
  (state: ApplicationState): WithPrivateImages => {
    const { error, itemsById, lastUpdated, loading } = state.__resources.images;
    const events = imageEvents(state.events);
    const privateImagesWithEvents = Object.values(itemsById).reduce(
      (accum, thisImage) =>
        produce(accum, draft => {
          if (!thisImage.is_public) {
            // NB: the secondary_entity returns only the numeric portion of the image ID so we have to interpolate.
            const matchingEvent = events.find(
              thisEvent =>
                thisEvent.secondary_entity &&
                `private/${thisEvent.secondary_entity.id}` === thisImage.id
            );
            if (matchingEvent) {
              draft.push({ ...thisImage, event: matchingEvent });
            } else {
              draft.push(thisImage);
            }
          }
        }),
      [] as ImageWithEvent[]
    );
    return {
      imagesData: privateImagesWithEvents,
      imagesLoading: loading,
      imagesError: error?.read,
      imagesLastUpdated: lastUpdated
    };
  },
  mapDispatchToProps
);

export default compose<CombinedProps, {}>(
  withPrivateImages,
  withRouter,
  withSnackbar
)(ImagesLanding);
