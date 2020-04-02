import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { getConfig } from '@edx/frontend-platform';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLock,
} from '@fortawesome/free-solid-svg-icons';

import BookmarkButton from './bookmark/BookmarkButton';
import { addBookmark, removeBookmark } from '../../data/course-blocks';
import VerifiedCert from '../course/course-sock/assets/verified-cert.png';

function Unit({
  bookmarked,
  bookmarkedUpdateState,
  enrollmentMode,
  displayName,
  graded,
  onLoaded,
  id,
  verifiedMode,
  ...props
}) {
  const iframeRef = useRef(null);
  const iframeUrl = `${getConfig().LMS_BASE_URL}/xblock/${id}?show_title=0&show_bookmark_button=0&in_mfe=1`;

  const [iframeHeight, setIframeHeight] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  useEffect(() => {
    global.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'plugin.resize') {
        setIframeHeight(payload.height);
        if (!hasLoaded && iframeHeight === 0 && payload.height > 0) {
          setHasLoaded(true);
          if (onLoaded) {
            onLoaded();
          }
        }
      }
    };
  }, []);

  const toggleBookmark = () => {
    if (bookmarked) {
      props.removeBookmark(id);
    } else {
      props.addBookmark(id);
    }
  };

  return (
    <div className="unit">
      <h2 className="mb-0 h4">{displayName}</h2>
      <BookmarkButton
        onClick={toggleBookmark}
        isBookmarked={bookmarked}
        isProcessing={bookmarkedUpdateState === 'loading'}
      />
      { graded && verifiedMode && enrollmentMode === 'audit' && (
          <div className="unit-content-container content-paywall">
            <div>
              <h4>
                <FontAwesomeIcon icon={faLock} />
                <span>Verified Track Access</span>
              </h4>
              <p>
                Graded assessments are available to Verified Track learners.
	        &nbsp;
                <a href={verifiedMode.upgradeUrl}>
                  Upgrade to unlock
                  ({verifiedMode.currencySymbol}{verifiedMode.price})
                </a>
              </p>
            </div>
            <div>
              <img alt="Example Certificate" src={VerifiedCert} />
            </div>
          </div>
      )}
      <div className="unit-iframe-wrapper">
        <iframe
          id="unit-iframe"
          title={displayName}
          ref={iframeRef}
          src={iframeUrl}
          allowFullScreen
          height={iframeHeight}
          scrolling="no"
          referrerPolicy="origin"
        />
      </div>
    </div>
  );
}

Unit.propTypes = {
  addBookmark: PropTypes.func.isRequired,
  bookmarked: PropTypes.bool,
  bookmarkedUpdateState: PropTypes.string,
  displayName: PropTypes.string.isRequired,
  enrollmentMode: PropTypes.string,
  graded: PropTypes.bool,
  id: PropTypes.string.isRequired,
  removeBookmark: PropTypes.func.isRequired,
  onLoaded: PropTypes.func,
  verifiedMode: PropTypes.shape({
    price: PropTypes.number.isRequired,
    currency: PropTypes.string.isRequired,
    currencySymbol: PropTypes.string,
    sku: PropTypes.string.isRequired,
    upgradeUrl: PropTypes.string.isRequired,
  }),
};

Unit.defaultProps = {
  bookmarked: false,
  bookmarkedUpdateState: undefined,
  enrollmentMode: undefined,
  graded: false,
  onLoaded: undefined,
  verifiedMode: null,
};

const mapStateToProps = (state, props) => state.courseBlocks.blocks[props.id] || {};

export default connect(mapStateToProps, {
  addBookmark,
  removeBookmark,
})(Unit);
